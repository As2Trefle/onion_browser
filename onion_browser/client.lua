local APP_IDENTIFIER = 'onion_browser'

CreateThread(function()
    while GetResourceState('lb-phone') ~= 'started' do
        Wait(200)
    end
    Wait(500)

    local res = GetCurrentResourceName()

    local success, err = exports['lb-phone']:AddCustomApp({
        identifier = APP_IDENTIFIER,
        name = 'Onion',
        description = 'Navigateur anonyme',
        developer = 'ALT',
        defaultApp = true,
        ui = ("%s/ui/index.html"):format(res),
        icon = ('https://cfx-nui-%s/ui/assets/icon-onion.jpg'):format(res),
        fixBlur = true
    })

    if success then
        print('[onion_browser] App enregistrée.')
    else
        print(('[onion_browser] Échec AddCustomApp: %s'):format(err or 'unknown'))
    end
end)

local QBCore = exports['qb-core']:GetCoreObject()

RegisterNUICallback('bb_copy_os', function(data, cb)
    local txt = tostring(data and data.text or '')
    if lib and lib.setClipboard then
        lib.setClipboard(txt)
        cb({ ok = true })
    else
        cb({ ok = false, reason = 'ox_lib_missing' })
    end
end)
