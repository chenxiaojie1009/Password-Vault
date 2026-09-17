"""首次运行时自动生成自签名 TLS 证书。

局域网内如果只提供明文 HTTP，设备密码与 JWT 会在链路上裸奔；但要求运维
手工签发证书又会把「手机能不能用」变成一道门槛。折中做法：程序首次启动
自动生成一张自签名证书，并覆盖本机所有地址（回环、主机名、各网卡 IPv4）。
客户端首次连接时确认一次指纹即可，之后按指纹信任（TOFU）。

证书随网卡地址变化自动重签：如果本机 IP 变了而旧证书没覆盖新 IP，客户端
会因为名称不匹配再次提示信任。
"""
import datetime
import ipaddress
import os
import socket

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

CERT_FILE_NAME = "tls.crt"
KEY_FILE_NAME = "tls.key"
VALID_DAYS = 3650

_COMMON_NAME = "Device Manager"


def local_ipv4_addresses():
    """本机对外的 IPv4 地址（排除回环与 169.254 链路本地地址）。"""
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    # UDP connect 不会真的发包，但能让系统选出默认出口网卡地址
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        ips.add(probe.getsockname()[0])
    except OSError:
        pass
    finally:
        probe.close()
    return sorted(
        ip for ip in ips
        if ip and not ip.startswith("127.") and not ip.startswith("169.254.")
    )


def _wanted_hosts():
    """证书需要覆盖的所有地址。"""
    hosts = {"127.0.0.1", "::1", "localhost"}
    try:
        hosts.add(socket.gethostname())
    except OSError:
        pass
    hosts.update(local_ipv4_addresses())
    return sorted(hosts)


def _san_of(cert):
    try:
        ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
    except x509.ExtensionNotFound:
        return set()
    names = set(ext.value.get_values_for_type(x509.DNSName))
    names.update(str(ip) for ip in ext.value.get_values_for_type(x509.IPAddress))
    return names


def _not_valid_after(cert):
    """兼容新旧 cryptography：返回带时区的到期时间。"""
    if hasattr(cert, "not_valid_after_utc"):
        return cert.not_valid_after_utc
    return cert.not_valid_after.replace(tzinfo=datetime.timezone.utc)


def _cert_covers(cert_path, hosts):
    try:
        with open(cert_path, "rb") as f:
            cert = x509.load_pem_x509_certificate(f.read())
    except Exception:
        return False
    now = datetime.datetime.now(datetime.timezone.utc)
    if _not_valid_after(cert) <= now + datetime.timedelta(days=1):
        return False
    return set(hosts).issubset(_san_of(cert))


def _generate(cert_path, key_path, hosts):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, _COMMON_NAME),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Device Manager"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)

    alt_names = []
    for host in hosts:
        try:
            alt_names.append(x509.IPAddress(ipaddress.ip_address(host)))
        except ValueError:
            alt_names.append(x509.DNSName(host))

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=VALID_DAYS))
        .add_extension(x509.SubjectAlternativeName(alt_names), critical=False)
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, key_encipherment=True, content_commitment=False,
                data_encipherment=False, key_agreement=False, key_cert_sign=False,
                crl_sign=False, encipher_only=False, decipher_only=False),
            critical=True)
        .sign(key, hashes.SHA256())
    )

    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    with open(key_path, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    try:
        os.chmod(key_path, 0o600)
    except OSError:
        pass
    return cert


def fingerprint_of(cert_path):
    """证书 SHA-256 指纹（大写冒号分隔），供人工核对。"""
    with open(cert_path, "rb") as f:
        cert = x509.load_pem_x509_certificate(f.read())
    return ":".join(f"{b:02X}" for b in cert.fingerprint(hashes.SHA256()))


def ensure_certificate(base_dir):
    """确保存在覆盖本机地址的自签名证书，返回 (cert_path, key_path, 是否新生成)。"""
    cert_path = os.path.join(base_dir, CERT_FILE_NAME)
    key_path = os.path.join(base_dir, KEY_FILE_NAME)
    hosts = _wanted_hosts()
    if os.path.exists(cert_path) and os.path.exists(key_path):
        if _cert_covers(cert_path, hosts):
            return cert_path, key_path, False
    _generate(cert_path, key_path, hosts)
    return cert_path, key_path, True
