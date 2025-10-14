local QBCore = exports['qb-core']:GetCoreObject()

-- Créer une annonce
RegisterNUICallback('bb_create_annonce', function(data, cb)
    QBCore.Functions.TriggerCallback('onion_browser:annonces:create', function(ok, idOrMsg)
        cb({ ok = ok == true, id = idOrMsg })
    end, data)
end)

-- Mes annonces
RegisterNUICallback('bb_list_my_annonces', function(_, cb)
    QBCore.Functions.TriggerCallback('onion_browser:annonces:listMine', function(payload)
        cb(payload or { ok = true, rows = {} })
    end)
end)

-- Toutes les annonces (flux public)
RegisterNUICallback('bb_list_all_annonces', function(_, cb)
    QBCore.Functions.TriggerCallback('onion_browser:annonces:listAll', function(payload)
        cb(payload or { ok = true, rows = {} })
    end)
end)

-- Copie OS (optionnel via ox_lib)
RegisterNUICallback('bb_copy_os', function(data, cb)
    local txt = tostring(data and data.text or '')
    if lib and lib.setClipboard then
        lib.setClipboard(txt)
        cb({ ok = true })
    else
        cb({ ok = false, reason = 'ox_lib_missing' })
    end
end)
