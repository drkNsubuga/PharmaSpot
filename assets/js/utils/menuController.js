const {app, dialog,ipcRenderer} = require('electron');
// const notiflix = require('notiflix');
const nativeImage = require('electron').nativeImage
const path = require('path')
const iconPath=path.join(__dirname, '../../../assets/images/favicon.png');
const appIcon = nativeImage.createFromPath(iconPath)
const appVersion = app.getVersion();
const appName= app.getName();
const pkg = require('../../../package.json')



function showAbout()
{
	if(app.isReady())
  dialog.showMessageBox({
      title: `${appName}`,
      message: `${appName} v${appVersion}`,
      detail: `©2017-${new Date().getFullYear()} ${pkg.author}`,
      icon: appIcon
     })
}



module.exports={showAbout}