local QBCore = exports['qb-core']:GetCoreObject()

-- NUI => Lua (FiveM)
RegisterNUICallback('bb_placeOrder', function(data, cb)
  local items = data and data.items or {}
  local total = data and data.total or 0

  QBCore.Functions.TriggerCallback('onion:blackbay:placeOrder', function(result)
    -- renvoyer directement au JS (NUI fetch attend un JSON)
    cb(result or { ok = false })
  end, items, total)
end)

-- Mes commandes (NUI -> serveur -> NUI)
RegisterNUICallback('bb_getOrders', function(data, cb)
  QBCore.Functions.TriggerCallback('onion:blackbay:getOrders', function(result)
    cb(result or { ok = false })
  end)
end)

-- Start paiement depuis l’UI
RegisterNUICallback('bb_startPayment', function(data, cb)
  local orderId = data and data.id
  QBCore.Functions.TriggerCallback('onion:blackbay:startPayment', function(res)
    if res and res.ok then
      StartBBPaymentMission(res.order, res.mailbox) -- crée la zone ox_target
    end
    cb(res or { ok=false })
  end, orderId)
end)

-- Mission : créer zone ox_target sur la mailbox + action "Envoyer l'argent"
local BB_ZONE_ID, BB_BLIP

function StartBBPaymentMission(order, mailbox)
  EndBBPaymentMission()

  -- supprime un éventuel waypoint violet
  SetWaypointOff()

  -- Blip + route GPS ORANGE uniquement
  BB_BLIP = AddBlipForCoord(mailbox.x+0.0, mailbox.y+0.0, mailbox.z+0.0)
  SetBlipSprite(BB_BLIP, 162)
  SetBlipScale(BB_BLIP, 0.8)
  SetBlipColour(BB_BLIP, 47)
  SetBlipRoute(BB_BLIP, true)
  SetBlipRouteColour(BB_BLIP, 47)
  BeginTextCommandSetBlipName('STRING')
  AddTextComponentString('Boîte aux lettres (Paiement)')
  EndTextCommandSetBlipName(BB_BLIP)

  -- Zone ox_target
  local radius = Config.MailboxZoneRadius or 1.6
  BB_ZONE_ID = exports.ox_target:addSphereZone({
    coords = vec3(mailbox.x, mailbox.y, mailbox.z),
    radius = radius,
    debug = false,
    options = {
      {
        name = ('bb_pay_%s'):format(order.id),
        icon = 'fa-solid fa-envelope',
        label = "Envoyer l'argent",
        onSelect = function()
          QBCore.Functions.TriggerCallback('onion:blackbay:depositCash', function(ret)
            if ret and ret.ok then
              PlaySoundFrontend(-1, 'PROPERTY_PURCHASE', 'HUD_AWARDS', false)
              EndBBPaymentMission()
              -- MAJ UI immédiate si l’app est ouverte
              SendNUIMessage({ action = 'bb:orderStatus', id = tostring(order.id), status = 'attente_livraison' })
              TriggerEvent('chat:addMessage', { args = { '^2BlackBay', 'Paiement déposé. Statut: Attente livraison.' } })
            else
              local missing = (ret and ret.missing) or 0
              TriggerEvent('chat:addMessage', { args = { '^1BlackBay', missing>0 and ('Il vous manque $'..missing..' en cash.') or 'Paiement impossible.' } })
            end
          end, tostring(order.id))
        end
      }
    }
  })
end


function EndBBPaymentMission()
  if BB_ZONE_ID then pcall(function() exports.ox_target:removeZone(BB_ZONE_ID) end) BB_ZONE_ID = nil end
  if BB_BLIP    then RemoveBlip(BB_BLIP) BB_BLIP = nil end
end

RegisterNetEvent('onion:blackbay:status', function(orderNo, status)
  SendNUIMessage({ action = 'bb:orderStatus', id = tostring(orderNo), status = status })
end)

-- Fermer le téléphone (sans toucher aux apps)
RegisterNUICallback('bb_closePhone', function(_, cb)
    local ok = pcall(function()
        exports['lb-phone']:ToggleOpen(false)
    end)
    cb({ ok = ok and true or false })
end)


RegisterNUICallback('bb_closeApp', function(_, cb)
    local ok = pcall(function()
        -- ferme l'app actuellement ouverte ; pas de ToggleOpen ici
        exports['lb-phone']:CloseApp({ closeCompletely = true })
    end)
    cb({ ok = ok and true or false })
end)