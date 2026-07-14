import { useState } from "react";
import { Card, Button, Upload, Typography, Space, message, Divider, Alert } from "antd";
import { CloudUploadOutlined, CloudServerOutlined, SafetyOutlined } from "@ant-design/icons";
import api from "../api/client";

const { Title, Text, Paragraph } = Typography;

export default function UpgradeRestore() {
  const [backingUp, setBackingUp] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const handleBackup = async () => {
    setBackingUp(true);
    try { await api.post("/backups"); message.success("备份完成"); }
    catch { message.error("备份失败"); }
    finally { setBackingUp(false); }
  };

  const handleUpgrade = async (file: File): Promise<false> => {
    if (!file.name.endsWith(".zip")) { message.error("请上传 .zip 文件"); return false; }
    setUpgrading(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      await api.post("/upgrade", fd);
      message.success("升级完成，请稍候刷新页面");
    } catch { message.error("升级失败"); setUpgrading(false); }
    return false;
  };

  return (
    <div>
      <Title level={4}><SafetyOutlined style={{ marginRight: 8 }} />升级与还原</Title>

      <Alert type="warning" showIcon style={{ marginBottom: 16 }}
        message="升级流程说明"
        description={
          <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
            1. 先点击"备份数据"保存当前数据库<br/>
            2. 选择升级包 (.zip) 上传<br/>
            3. 自动解压替换程序文件<br/>
            4. 自动恢复备份的数据<br/>
            5. 服务自动重启，刷新浏览器即可
          </Paragraph>
        }
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Title level={5}>① 升级前备份</Title>
        <Button type="primary" icon={<CloudServerOutlined />} loading={backingUp} onClick={handleBackup}>
          备份数据
        </Button>
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Title level={5}>② 上传升级包</Title>
        <Upload accept=".zip" maxCount={1} showUploadList={false} beforeUpload={handleUpgrade as any}>
          <Button icon={<CloudUploadOutlined />} loading={upgrading} size="large">
            选择升级包并开始升级
          </Button>
        </Upload>
        <Divider />
        <Text type="secondary">
          升级包应为 .zip 格式，包含 DeviceManager.exe 及需要更新的文件。
          升级过程中服务会自动重启，请稍等片刻后刷新页面。
        </Text>
      </Card>
    </div>
  );
}
