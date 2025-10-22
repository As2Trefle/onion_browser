local QBCore = exports['qb-core']:GetCoreObject()

RegisterNUICallback('bb_get_config', function(data, cb)
    cb({ ok = true, config = {
        maxSalesPerCitizen = Config.MaxSalesPerCitizen or 5,
        maxQtyPerSale      = Config.MaxQtyPerSale or 5
    }})
end)

RegisterNUICallback('bb_list_my_sales', function(data, cb)
    QBCore.Functions.TriggerCallback('onion:bb_list_my_sales', function(rows)
        cb({ ok = true, rows = rows or {} })
    end)
end)

RegisterNUICallback('bb_create_sale', function(data, cb)
    local item = tostring(data.item or '')
    local qty  = tonumber(data.qty or 1) or 1
    QBCore.Functions.TriggerCallback('onion:bb_create_sale', function(res)
        cb(res or { ok = false, reason = 'unknown' })
    end, item, qty)
end)

RegisterNUICallback('bb_delete_sale', function(data, cb)
    local saleId = tonumber(data.id or 0) or 0
    QBCore.Functions.TriggerCallback('onion:bb_delete_sale', function(res)
        cb(res or { ok = false })
    end, saleId)
end)

RegisterNUICallback('bb_start_delivery', function(data, cb)
    local saleId = tonumber(data.id or 0) or 0
    QBCore.Functions.TriggerCallback('onion:bb_start_delivery', function(res)
        cb(res)

        if res and res.ok and res.mission then
            StartBlackBayMission(res.mission)
            TriggerEvent('QBCore:Notify', 'Mission lancée : va livrer le colis au point indiqué.', 'success', 6500)
            pcall(function()
                exports['lb-phone']:CloseApp({ closeCompletely = true })
            end)
            exports['lb-phone']:ToggleOpen(false, true)
        end
    end, saleId)
end)

local Mission = nil

local function CleanupMission()
    if Mission then
        if Mission.target and exports.ox_target then
            pcall(function() exports.ox_target:removeZone(Mission.target) end)
        end
        if Mission.blip and DoesBlipExist(Mission.blip) then
            RemoveBlip(Mission.blip)
        end
        Mission = nil
    end
end

function StartBlackBayMission(m)
    CleanupMission()

    local pos = vector3(m.coords.x, m.coords.y, m.coords.z)

    local blip = AddBlipForCoord(pos.x, pos.y, pos.z)
    SetBlipSprite(blip, 501); SetBlipScale(blip, 0.8); SetBlipColour(blip, 47)
    BeginTextCommandSetBlipName('STRING'); AddTextComponentString('Point de livraison BlackBay'); EndTextCommandSetBlipName(blip)
    SetBlipRoute(blip, true); SetBlipRouteColour(blip, 47)

    local zoneId = nil
    if exports.ox_target then
        local opts = {{
            name  = 'bb_delivery_drop_'..m.sale_id,
            icon  = 'fa-solid fa-box',
            label = 'Déposer le colis',
            onSelect = function()
                TriggerServerEvent('onion:delivery_finish', m.sale_id)
            end
        }}

        local ok, id = pcall(function()
            return exports.ox_target:addSphereZone({
                coords  = pos,
                radius  = (Config and Config.MailboxZoneRadius) or 1.6,
                debug   = false,
                options = opts,
            })
        end)
        if ok and id then
            zoneId = id
        else
            zoneId = exports.ox_target:addSphereZone(
                'bb_delivery_'..m.sale_id,
                pos,
                (Config and Config.MailboxZoneRadius) or 1.6,
                { name='bb_delivery_'..m.sale_id, debug = false },
                { options = opts }
            )
        end
    end

    Mission = { blip = blip, target = zoneId }
end

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        CleanupMission()
    end
end)

RegisterNetEvent('onion:delivery_done', function(ok, reason)
    if ok then
        CleanupMission()
        TriggerEvent('QBCore:Notify', 'Colis livré. Paiement reçu.', 'success')
    else
        local msg = 'Livraison échouée'
        if     reason == 'no_space'         then msg = 'Inventaire plein: libère de la place.'
        elseif reason == 'not_enough_items' then msg = 'Tu n\'as pas la quantité requise sur toi.'
        elseif reason == 'too_far'          then msg = 'Trop loin du point de dépôt.'
        end
        TriggerEvent('QBCore:Notify', msg, 'error')
    end
end)
