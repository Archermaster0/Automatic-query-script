const axios = require("axios")
const fs = require("fs")
const { JSDOM } = require("jsdom") //html内容处理
const nodemailer = require("nodemailer") //邮件发送

const administrator = ['1311211019@qq.com', '630701218@qq.com'] //管理员邮箱  接收报错邮件
const recipientArr = ['1311211019@qq.com'] //收件人邮箱
const sendMessage = '1000HD 又来新订单啦! 赶快去查看吧!'  //发送信息内容
const titleMessage = '下看板啦' //邮件标题
const intervalTime = 3000  //运行间隔时间 单位是毫秒

// 定义目标 URL 和请求头
const url = "https://les.mychery.com/lesuppl/supplierreceive/jit_receive.action"

let formatDateTime = function (date) {
  let y = date.getFullYear();
  let m = date.getMonth() + 1;
  m = m < 10 ? ('0' + m) : m;
  let d = date.getDate();
  d = d < 10 ? ('0' + d) : d;
  let h = date.getHours();
  h = h < 10 ? ('0' + h) : h;
  let minute = date.getMinutes();
  minute = minute < 10 ? ('0' + minute) : minute;
  let second = date.getSeconds();
  second = second < 10 ? ('0' + second) : second;
  return {
    time: y + '-' + m + '-' + d + ' ' + h + ':' + minute + ':' + second,
    dayTime: y + '-' + m + '-' + d + ' '
  }
}

let date = new Date()
const { time, dayTime } = formatDateTime(date)



const headers = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6,zh-HK;q=0.5",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "Content-Type": "application/x-www-form-urlencoded",
  Origin: "https://les.mychery.com",
  Referer: "https://les.mychery.com/lesuppl/supplierreceive/jit_receive.action",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Pragma: "no-cache",
};
// 定义请求体数据（FormData 格式）
const data = new URLSearchParams({
  "query.queryCondition.sheetNo": "",
  "query.queryCondition.supplNo": "1000HD",
  "query.queryCondition.partNo": "",
  "query.queryCondition.sheetStatus": "",
  "query.queryCondition.plantNo": "",
  "query.queryCondition.workshopNo": "",
  "query.queryCondition.sxCardNo": "",
  "query.queryCondition.isEmergent": "",
  "query.queryCondition.createTimeBegin": `${dayTime}`,
  "query.queryCondition.createTimeEnd": `${dayTime}`,
  "query.queryCondition.note2": "",
  "query.queryCondition.note4": "",
  "query.queryCondition.deliveryRecType": "",
});
// 定义 Cookies（会话保持的关键）
const cookies = "JSESSIONID=B9C837B51DF22A455B9FB9AAE6043C11; cookiesession1=678B287C366793980B7EDFBE2511376F";
// 提取表格内容的函数
const extractTable = (htmlContent) => {
  const dom = new JSDOM(htmlContent)
  const table = dom.window.document.querySelector("table#idTable")
  if (!table) {
    console.log('请先登录')
    //发送报错邮件
    // sendNotification(administrator, '报错信息', '请重新登录, 并更新cookie')
    return
  }
  if (table) {
    return table.outerHTML; // 返回表格的 HTML 字符串
  } else {
    return "Not Found"
  }
}
// 发送 POST 请求并处理响应
const fetchAndSaveTable = async () => {
  try {
    const response = await axios.post(url, data.toString(), {
      headers: {
        ...headers,
        Cookie: cookies,
      },
      responseType: "text", // 确保返回 HTML 内容
    });
    if (response.status === 200) {
      // 提取表格内容
      const tableContent = extractTable(response.data);
      //如果表格内容为空
      if (tableContent === 'Not Found') {
        console.log('查询成功  暂无数据')
        return
      }
      let newFormData = tableConverObject(tableContent) //将最新的数据转换成数组对象
      //获取对应数据 并进行处理
      await getDataAndProcess(newFormData)

      console.log(`${time} 查询成功`)
    } else {
      console.error(`Failed to fetch data. Status: ${response.status}`);
    }
  } catch (error) {
    //发送报错邮件
    sendNotification(administrator, '报错信息', error.message)
    console.error("Error fetching or processing data:", error.message);
  }
};
//数据获取并处理
const getDataAndProcess = async (newData) => {
  try {
    fs.readFile('data_warehouse.json', "utf-8", (err, data) => {
      if (err) {
        if (err.errno === -4058) {
          fs.writeFileSync('data_warehouse.json', JSON.stringify(newData), "utf-8")
          console.log('数据库创建成功')
          return
        }
        //发送报错邮件
        sendNotification(administrator, '报错信息', err)
      }
      let oldFormData = JSON.parse(data) //获得之前的数据
      //对数据进行比对 获得添加的新数据
      let diffDatas = dataDiff(oldFormData, newData)
      if (diffDatas.length === 0) {
        return
      }

      //将新数据写入文件
      fs.writeFileSync('data_warehouse.json', JSON.stringify(newData), "utf-8")

      //发送邮件
      sendNotification(recipientArr, titleMessage, sendMessage)
    })
  } catch (error) {
    //发送报错邮件
    sendNotification(administrator, '报错信息', error.message)
    console.log(error)
  }
}
//表格转换为对象
const tableConverObject = (data) => {
  const dom = new JSDOM(data)
  const $table = dom.window.document.getElementById("idTable")
  const $headers = $table.querySelectorAll('thead th')
  const $rows = $table.querySelectorAll('tbody tr')
  let headers = Array.prototype.map.call($headers, item => {
    return item.textContent
  })
  let jsonData = Array.prototype.map.call($rows, item => {
    let $cells = item.querySelectorAll('td')
    return Array.prototype.reduce.call($cells, (acc, item, idx) => {
      let text = item.textContent.replace(/[\t\n]/g, '').trim()
      acc[headers[idx]] = text
      return acc
    }, {})
  })
  return jsonData
}
//数据比对
function dataDiff(originalData, newData) {
  let newDatas = newData.filter(item => {
    return !originalData.some(ele => ele['物料单号'] === item['物料单号'])
  })
  return newDatas
}
//发送邮件通知
function sendNotification(recipients, title, message) {
  // 定义邮件服务器服
  const transporter = nodemailer.createTransport({
    host: 'smtp.163.com',
    secure: true,

    // 我们需要登录到网页邮箱中，然后配置SMTP和POP3服务器的密码
    auth: {
      user: '18123278773@163.com',
      pass: 'ZHuUC33UtbiKWjGP'  //这里是授权密码而不是邮件密码
    }
  })
  //创建一个收件人对象
  const mail = {
    // 发件人 邮箱  '昵称<发件人邮箱>'
    from: `18123278773@163.com`,
    // 主题
    subject: title,
    // 收件人 的邮箱 可以是其他邮箱 不一定是网易邮箱
    to: recipients,
    //这里可以添加html标签
    html: message
  }
  //  发送邮件 调用transporter.sendMail(mail, callback)
  transporter.sendMail(mail, function (error, info) {
    if (error) {
      return console.log(error)
    }
    transporter.close()
    console.log('mail sent:', info.response)
  })
}

// 定时任务，每隔 1000 秒运行一次
setInterval(fetchAndSaveTable, intervalTime);

// 初次运行
fetchAndSaveTable();
