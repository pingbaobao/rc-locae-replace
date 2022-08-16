const { globalData } = require('./data')

function generateI18nData() {
    const { to } = globalData
    const i18nMap = globalData.i18nMap
    const i18nMapEn = globalData.i18nMapEn

    const i18nData = {
        zh: {},
    }

    i18nData[to] = {}
    const messages = Object.keys(i18nMap)

    return new Promise(resolve => {
        if (!messages.length) resolve(i18nData)
        i18nData.zh = i18nMap
        i18nData.en = i18nMapEn  
        resolve(i18nData)
    })
}

module.exports = generateI18nData