fx_version 'cerulean'
game 'gta5'

name 'onion_browser'
author 'Dan'
description 'LB-Phone app: Onion Browser (search engine)'
version '0.1.0'
lua54 'yes'

shared_script 'config.lua'

files {
  'ui/index.html',
  'ui/styles/*.css',
  'ui/scripts/*.js',
  'ui/assets/**.*',
  'ui/pages/**/**',

}

client_scripts {
  '@ox_lib/init.lua',
  'client.lua',
  'client/*.lua',
}

server_scripts {
  '@oxmysql/lib/MySQL.lua',
  'server/*.lua',
  'server.lua',
}