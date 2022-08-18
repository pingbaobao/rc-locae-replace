const { globalData } = require('./data')
const { translate } = require('./translate')
const { throttle, convertStringToCamelCase } = require('./utils')
const ProgressBar = require('progress')
let i18nMap, prefix, suffix, pluginPrefix, i18nMapEn

function waitTime(time) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

async function processSource(code = '') {
    i18nMap = globalData.i18nMap
    i18nMapEn = globalData.i18nMapEn
    prefix = globalData.prefix
    suffix = globalData.suffix
    pluginPrefix = globalData.pluginPrefix

    let arr
    let separator
    if (code.split('\r\n').length > 1) {
        arr = code.split('\r\n')
        separator = '\r\n'
    } else {
        arr = code.split('\n')
        separator = '\n'
    }
    _processSource(arr, true)
    const translateLength = _processSource(arr)
    // 进度条
    const bar = new ProgressBar('translating [:bar] :percent :etas', { total: translateLength })
    bar.tick()
    const timer = setInterval(() => {
        bar.tick()
    }, globalData.delay)
    await waitTime(globalData.delay*translateLength)
    clearInterval(timer)
    return arr.join(separator)
}

function _processSource(data = [], isTemplate = false) {
    let index = 0
    const len = data.length
    if (isTemplate) {
        while (index < len) {
            if (/^<template>/.test(data[index++].trim())) break
        }
    }
    const reg1 = /[\u4e00-\u9fa5]/
    const reg2 = /[\u4e00-\u9fa5]|[\u3002\uff1b\uff0c\uff1a\u201c\u201d\uff08\uff09\u3001\uff1f\u300a\u300b]|-|\.|\/|\(|\)|\d/
    const symbols = ['—', '【', '】', '！']
    let hasMulNote = false // 是否有多行注释
    let translateNumber = 0
    while (index < len) {
        if (isTemplate) {
            if (/^<script>/.test(data[index].trim())) break
        }

        const arr = []
        const str = data[index]
        const l = str.length
        let i = 0
        while (i < l) {
            // 去除行首空格
            while (str[i] == ' ') {
                i++
            }

            // 多行注释
            if (hasMulNote) {
                while (!(str[i] == '*' && str[i + 1] == '/') && i < l) {
                    i++
                }

                if (i == l) break
                hasMulNote = false
                i += 2
            }

            // 跳过注释 <!-- -->
            if (str[i] == '<' && str[i + 1] == '!' && str[i + 2] == '-' && str[i + 3] == '-') {
                i += 4
                while (!(str[i] == '-' && str[i + 1] == '-' && str[i + 2] == '>') && i < l) {
                    i++
                }

                if (i == l || i + 3 >= l) break
                i += 3
            }

            /** */
            /**
             * 
             */
            if (str[i] == '/' && str[i + 1] == '*') {
                while (!(str[i] == '*' && str[i + 1] == '/') && i < l) {
                    i++
                }

                if (i == l) {
                    hasMulNote = true
                    break
                }

                if (i + 2 >= l) break
                i += 2
            }

            // 单行注释
            if (str[i] == '/' && str[i + 1] == '/') break

            if (reg1.test(str[i])) {
                const start = i
                while (reg2.test(str[i]) || symbols.includes(str[i])) {
                    i++
                }

                arr.push({
                    start,
                    end: i - 1,
                })
            }

            i++
        }

        if (isTemplate) {
            data[index] = extractTemplate(data[index], arr, index)
        } else {
            if (arr.length) {
                translateNumber+=1
            }
            // eslint-disable-next-line no-loop-func
            extractScript(data[index], arr, index).then(res => {
                data[res.index] = res.data
            })
        }
        index++
    }
    return translateNumber
}

function extractTemplate(str = '', replaceData = []) {
    if (!replaceData.length) return str
    const arr = []
    replaceData.forEach(item => {
        let start = item.start
        let end = item.end
        // 0 HTML 文本
        // 1 :value="test + '测试'"
        // 2 :value="测试"
        let type = 0
        while (start-- >= 0) {
            while (str[start] == ' ') {
                start--
            }

            if (start < 0) {
                start = item.start
                break
            }

            if (str[start] == '"' || str[start] == '\'') {
                let temp = start
                start--
                while (str[start] == ' ') {
                    start--
                }

                if (str[start] == '=') {
                    start--
                    // :class="{ a: b != '测试'}"
                    if (str[start] == '!' || str[start] == '=') {
                        start = temp
                        type = 1
                        break
                    }

                    while (str[start] == ' ') {
                        start--
                    }

                    while (str[start] != ' ') {
                        start--
                    }

                    start++
                    type = 2
                } else {
                    start = temp
                    type = 1
                }

                break
            } else {
                start++
                break
            }
        }

        while (end++ < str.length) {
            while (str[start] == ' ') {
                start++
            }

            if (start >= str.length) {
                end = item.end
                break
            }

            if (str[end] == '"' || str[end] == '\'') {
                break
            } else if (str[end] == '<') {
                end--
                break
            }
        }

        arr.push({
            type,
            word: str.slice(item.start, item.end + 1),
            source: str.slice(start, end + 1),
        })
    })

    return replaceTemplate(str, arr)
}

function checkJSX(str = '', end = 0) {
    // 判断代码: test('这是一个测试')
    let start = 0
    let hasLeft = false
    const len = str.length
    while (start < len) {
        const c = str[start++]
        if (c == `'` || c == `"`) break
        if (c == '(') {
            hasLeft = true
            break
        }
    }

    if (hasLeft) {
        while (start < len) {
            const c = str[start++]
            if (c == ')') return false
        }
    }

    // 判断代码: <h1>测试</h1>
    while (str[end] != '"' && end >= 0) {
        end--
    }

    while (str[end] != '=' && end >= 0) {
        end--
    }

    const temp = str.slice(0, end)
    if (!temp.includes('const ') && !temp.includes('let ') && !temp.includes('var ')) {
        return true
    }

    return false
}

async function extractScript(str = '', replaceData = [], index) {
    if (!replaceData.length) return Promise.resolve(str)
    const arr = []
    replaceData.forEach(item => {
        let isJSX = checkJSX(str, item.start)
        let start = item.start
        let end = item.end
        // 中文两边是否有 ' " ` 等符号
        let hasSymbol = false
        let isAttribute = false
        while (start >= 0) {
            // <input> 中文
            if (isJSX && str[start] == '>') {
                start++
                break
            }
            if (str[start-1]==':'||(str[start-1]==' '&&str[start-2]==':')||str[start-1]=='(') {
                isAttribute = true
            }

            if (str[start] == '"' || str[start] == '\'' || str[start] == '`') {
                hasSymbol = true
                break
            }

            start--
        }

        if (start < 0) start = item.start
        while (end < str.length) {
            // 中文 <input>
            if (isJSX && !hasSymbol && str[end] == '<') {
                end--
                break
            }

            if (str[end] == '"' || str[end] == '\'' || str[end] == '`') {
                hasSymbol = true
                break
            }

            end++
        }

        if (end == str.length) end = item.end

        arr.push({
            isJSX,
            hasSymbol,
            isAttribute,
            word: str.slice(item.start, item.end + 1),
            source: str.slice(start, end + 1),
        })
    })

    const res = await replaceScript(str, arr)
    return Promise.resolve({
        data: res,
        index,
    })
}

function replaceTemplate(str = '', data = []) {
    let result = str
    data.forEach(item => {
        let s = item.source
        let temp
        let replace
        const word = item.word

        if (i18nMap[word]) {
            replace = i18nMap[word]
        } else {
            i18nMap[word] = prefix + word + suffix
            replace = prefix + word + suffix
        }

        switch (item.type) {
            case 0:
                s = s.replace(word, `{{ ${pluginPrefix}('${replace}') }}`)
                break
            case 1:
                s = s.slice(1, s.length - 1)
                temp = s.replace(word, '')
                if (temp.length) {
                    s = `${pluginPrefix}('${replace}') + '${temp}'`
                } else {
                    s = `${pluginPrefix}('${replace}')`
                }

                break
            case 2:
                temp = s.slice(s.indexOf(word) + word.length, s.length - 1)
                if (temp.length) {
                    s = `:${s.slice(0, s.indexOf(word))}${pluginPrefix}('${replace}') + '${temp}'"`
                } else {
                    s = `:${s.slice(0, s.indexOf(word))}${pluginPrefix}('${replace}')"`
                }

                break
        }

        result = result.replace(item.source, s)
    })

    return result
}

function replaceScript(str = '', data = []) {
    let result = str
    return new Promise(resolve => {
        data.forEach((item, i) => {
            const word = item.word
            let s
            let replace
            let translateWord
            if (item.hasSymbol) {
                s = item.source.slice(1, item.source.length - 1)
            } else {
                s = item.source
            }
            throttle(() => {
                translate(word).then(res => {
                    if (res) {
                        translateWord = res[0].dst
                    } else {
                        translateWord = word
                    }
                    if (i18nMap[word]) {
                        replace = i18nMap[word]
                    } else {
                        i18nMap[prefix + convertStringToCamelCase(translateWord) + suffix] = word
                        i18nMapEn[prefix + convertStringToCamelCase(translateWord) + suffix] = translateWord
                        replace = prefix + convertStringToCamelCase(translateWord) + suffix
                    }
                    if (item.isAttribute) {
                        s = s.replace(word, `intl.formatMessage({id: '${replace}', defaultMessage: '${word}'})`)
                    } else {
                        // eslint-disable-next-line no-useless-concat
                        s = s.replace(word, '{' + `intl.formatMessage({id: '${replace}', defaultMessage: '${word}'})` + '}')
                    }
                    result = result.replace(item.source, s)
                    if (i == data.length - 1) {
                        resolve(result)
                    }
                })
            })
        })
    })
}

module.exports = processSource