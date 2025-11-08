# 如何接入Youtube

## 📋 准备工作

1. **网络环境**: 可以访问[https://youtube.com](https://youtube.com)的网络环境
2. **Youtube账号**: Youtube账号

---

## 🔧 详细步骤

推特获取基于[Composio](https://platform.composio.dev/)

### 步骤 1: 登录注册Composio

打开浏览器,访问 [https://platform.composio.dev](https://platform.composio.dev)

### 步骤 2: 新建Project并进入(若已有Project则可跳过此步骤)

![](https://cdn.ziliu.online/images/2025/11/902e0d6c-1acc-43eb-bdd0-556592a444ce.jpg)

### 步骤 3: 获取API_KEY

切到"Settings"下，创建API_KEY并复制

![](https://cdn.ziliu.online/images/2025/11/bf58c767-6b16-4aa5-ac82-04c2562872e4.jpg)

### 步骤 4: 切到"Auth Configs"

切到"Auth Configs",点击「Create Auth Config」按钮

![](https://cdn.ziliu.online/images/2025/11/d2944bdd-0021-4038-bc20-71021460b898.jpg)
   
### 步骤 5: 搜索"youtube"

在过滤框中搜索"youtube"，并点击

![](https://cdn.ziliu.online/images/2025/11/614b0994-c351-4374-9a66-734e99c40bbe.jpg)

### 步骤 6: 点击创建

如图，点击创建

![](https://cdn.ziliu.online/images/2025/11/67aacdac-f647-46db-8efe-0dbe7a77a67d.jpg)

### 步骤 7: 链接你的账号

点击「Connect Account」

![](https://cdn.ziliu.online/images/2025/11/36a721ed-8d07-4d2a-81ee-87b2dff82339.jpg)

### 步骤 8: 保存COMPOSIO_USER_ID_YOUTUBE

这就是COMPOSIO_USER_ID_YOUTUBE，保存下，然后点击连接

![](https://cdn.ziliu.online/images/2025/11/a388789e-151b-41eb-a3ab-8b270beca782.jpg)

### 步骤 9: 继续

点击继续

![](https://cdn.ziliu.online/images/2025/11/ff09cbba-ab4a-4e7a-8327-289052ea06dc.jpg)

### 步骤 10: 确认授权

按照指引，完成授权流程授权

### 步骤 11: 授权成功

授权成功后会显示该界面

![](https://cdn.ziliu.online/images/2025/11/90097271-0ad2-4ced-b0ff-514c4cfbdf6a.jpg)

### 步骤 12: 获取COMPOSIO_CONNECTION_ID_TWITTER

回到控制台，此时记录中会多出一条

![](https://cdn.ziliu.online/images/2025/11/9a6c3998-39e9-4f49-bc8b-75b208654d2c.jpg)

---

## 💾 保存到配置文件

### 添加配置

在 `.env` 文件中配置:

```bash
COMPOSIO_API_KEY=步骤3中获取
COMPOSIO_CONNECTION_ID_YOUTUBE=步骤8中获取 或 步骤12中也可获取
COMPOSIO_USER_ID_YOUTUBE=步骤12中获取
```
