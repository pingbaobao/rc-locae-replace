
### 前端国际化辅助工具——自动替换中文并翻译

#### 全局安装

`npm i rc-locale-replace -g`


全局安装后，打开你的项目，建立一个 local-replace.config.js 文件，配置项如下：

```js
module.exports = {
    delay: 1500, // 自动翻译延时，必须大于 1000 ms，否则调用百度翻译 API 会失败, 土豪绕过
    mapFile: '', // 需要生成默认 map 的文件
    appid: '', // 百度翻译 appid, 免费个人拥护每月5万字符
    key: '', // 百度翻译密钥
    output: 'local-replace-data.js', // i18n 输出文件
    indent: 4, // i18n 输出文件缩进
    entry: '', // 要翻译的入口目录或文件，默认为命令行当前的 src 目录
    prefix: '', // i18n 变量前缀  i18n 变量生成规则 prefix + id + suffix
    suffix: '', // i18n 变量后缀
    to: 'en', // 中文翻译的目标语言
    loader: 'loader.js',
    include: [], // 需要翻译的目录或文件
    exclude: [], // 不需要翻译的目录或文件 如果 exclude include 同时存在同样的目录或文件 则 exclude 优先级高
    extra: /(\.tsx)|(\.ts)$/, // 默认支持 .vue 和 .js 文件 如果需要支持其他类型的文件，请用正则描述 例如这个示例额外支持 .tsx .ts 文件
}
```
需要翻译功能，一般只需要填入 appid、key， 请自行注册


设计配置项后，执行:
```
rc-replace
```
