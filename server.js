//一切为了省资源  运行占用和py相当
const { exec } = require("child_process");

const token = "$ARGO_AUTH";

//闹海3参数
const serverHost = "$NEZHA_SERVER";
const serverPort = 443;
const serverToken = "$NEZHA_KEY";

const url = "http://127.0.0.1";
const port = process.env.PORT || 3000;
const express = require("express");
const app = express();
const { createProxyMiddleware } = require("http-proxy-middleware");
const request = require("request");
const fs = require("fs");
const os = require("os");

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function runCF() {
  try {
    const cmdChmodCF = "chmod +x ./cf.sh";
    await execAsync(cmdChmodCF);
    const cmdRunCF = `nohup ./cf.sh tunnel --edge-ip-version auto run --protocol http2 --token ${token} >/dev/null 2>&1 &`;
    await execAsync(cmdRunCF);
  } catch (err) {
    console.error("运行 cf.sh 脚本时发生错误：", err);
  }
}

async function runNZ() {
  try {
    const cmdChmodNZ = "chmod +x ./nz.sh";
    await execAsync(cmdChmodNZ);
    const cmdNZ = `nohup ./nz.sh -s ${serverHost}:${serverPort} -p ${serverToken} --tls --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &`;
    await execAsync(cmdNZ);
  } catch (err) {
    console.error("运行 nz.sh 脚本时发生错误：", err);
  }
}

async function runWeb() {
  try {
    const cmdChmodWeb = "chmod +x ./data.sh";
    await execAsync(cmdChmodWeb);
    const cmdWeb = "nohup ./data.sh -c ./config.json >/dev/null 2>&1 &";
    await execAsync(cmdWeb);
  } catch (err) {
    console.error("运行 data.sh 脚本时发生错误：", err);
  }
}

async function runRoot() {
  try {
    const cmdStr = "bash root.sh >/dev/null 2>&1 &";
    await execAsync(cmdStr);
  } catch (err) {
    console.error("root权限部署错误：", err);
  }
}

(async () => {
  await runCF();
  await runNZ();
  await runWeb();

  app.get("/", function (req, res) {
    res.send("root password");
  });

  app.get("/listen", function (req, res) {
    let cmdStr = "ss -nltp";
    exec(cmdStr, function (err, stdout, stderr) {
      if (err) {
        res.type("html").send("<pre>命令行执行错误：\n" + err + "</pre>");
      } else {
        res.type("html").send("<pre>获取系统监听端口：\n" + stdout + "</pre>");
      }
    });
  });

  app.get("/info", function (req, res) {
    let cmdStr = "cat /etc/*release | grep -E ^NAME";
    exec(cmdStr, function (err, stdout, stderr) {
      if (err) {
        res.send("命令行执行错误：" + err);
      } else {
        res.send(
          "命令行执行结果：\n" +
            "Linux System:" +
            stdout +
            "\nRAM:" +
            os.totalmem() / 1000 / 1000 +
            "MB"
        );
      }
    });
  });

  app.get("/arch", function (req, res) {
    res.send("系统架构：" + os.arch());
  });

  app.get("/test", function (req, res) {
    fs.writeFile("./test.txt", "这里是新创建的文件内容!", function (err) {
      if (err) {
        res.send("创建文件失败，文件系统权限为只读：" + err);
      } else {
        res.send("创建文件成功，文件系统权限为非只读：");
      }
    });
  });

  app.get("/root", function (req, res) {
    runRoot();
  });

  app.use(
    "/",
    createProxyMiddleware({
      changeOrigin: true,
      onProxyReq: function onProxyReq(proxyReq, req, res) {},
      pathRewrite: {
        "^/": "/"
      },
      target: "http://127.0.0.1:8080/",
      ws: true
    })
  );

  app.listen(port, () => console.log(`Example app listening on port ${port}!`));
})();
