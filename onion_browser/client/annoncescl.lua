local QBCore = exports['qb-core']:GetCoreObject()

RegisterNUICallback('bb_create_annonce', function(data, cb)
    QBCore.Functions.TriggerCallback('onion_browser:annonces:create', function(ok, idOrMsg)
        cb({ ok = ok == true, id = idOrMsg })
    end, data)
end)

RegisterNUICallback('bb_list_my_annonces', function(_, cb)
    QBCore.Functions.TriggerCallback('onion_browser:annonces:listMine', function(payload)
        cb(payload or { ok = true, rows = {} })
    end)
end)

RegisterNUICallback('bb_list_all_annonces', function(_, cb)
    QBCore.Functions.TriggerCallback('onion_browser:annonces:listAll', function(payload)
        cb(payload or { ok = true, rows = {} })
    end)
end)
