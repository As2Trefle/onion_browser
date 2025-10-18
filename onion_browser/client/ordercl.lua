-- ordercl.lua — Airdrop SIMPLE: caisse + parachute au-dessus du joueur
-- - Descente contrôlée (clamp de vitesse verticale, freinage proche du sol)
-- - Interaction: ox_target (prioritaire) / qb-target (fallback) / touche E
-- - Stash: qb-inventory (le serveur remplit le stash à l’ouverture)
-- - La caisse NE despawn PAS à l’ouverture; elle despawn seulement quand le stash est VIDE
--   (le serveur enverra 'onion_airdrop:crate:despawn')

local QBCore = exports['qb-core']:GetCoreObject()

-- ================= UI helpers (lb-phone -> QBCore) =================
local function phonePopup(opts)
    local ok = pcall(function()
        exports['lb-phone']:SetPopUp({
            title = opts.title or 'BlackBay',
            description = opts.description or '',
            buttons = opts.buttons or { { title = 'OK' } },
        })
    end)
    if not ok then
        TriggerEvent('QBCore:Notify', opts.description or opts.title or 'Info', 'primary')
    end
end

local function phoneNotify(title, content, ntype)
    ntype = ntype or 'primary'
    local ok = pcall(function()
        exports['lb-phone']:SendNotification({
            app = 'BlackBay',
            title = title or 'BlackBay',
            content = content or '',
        })
    end)
    if not ok then TriggerEvent('QBCore:Notify', content or title or 'Info', ntype) end
end

-- ================= NUI: créer / lister / airdrop =================
RegisterNUICallback('blackbay:order:place', function(data, cb)
    local items = data and data.items or {}
    local confirmLarge = data and data.confirmLarge or false
    QBCore.Functions.TriggerCallback('onion_browser:order:attempt', function(resp)
        if not resp or resp.ok ~= true then
            if resp and resp.reason == 'not_authorized' then
                phonePopup({ title='Accès refusé', description='Grade requis (Boss ou Second).' })
            elseif resp and resp.reason == 'need_confirm_split' then
                -- ta NUI doit relancer avec confirmLarge=true après confirmation
            else
                phonePopup({ title='BlackBay', description='Erreur lors de la commande.' })
            end
            return cb(resp or { ok = false })
        end
        phoneNotify('BlackBay', ('Commande créée (#%s, %d lot%s).'):format(
            tostring(resp.order_uid), tonumber(resp.chunks) or 1, (tonumber(resp.chunks) or 1) > 1 and 's' or ''
        ), 'success')
        cb(resp)
    end, items, confirmLarge)
end)

RegisterNUICallback('blackbay:orders:list', function(_, cb)
    QBCore.Functions.TriggerCallback('onion_browser:orders:list', function(rows)
        cb({ ok = true, orders = rows or {} })
    end)
end)

RegisterNUICallback('blackbay:orders:airdrop', function(data, cb)
    local id = data and data.order_uid
    if not id then return cb({ ok = false }) end
    QBCore.Functions.TriggerCallback('onion_browser:orders:airdrop:start', function(resp)
        if not resp or resp.ok ~= true then
            if resp and resp.reason == 'bad_status' then
                phonePopup({ title='BlackBay', description='Commande déjà en cours ou livrée.' })
            else
                phonePopup({ title='BlackBay', description='Impossible de lancer l’airdrop.' })
            end
            return cb(resp or { ok = false })
        end
        phoneNotify('BlackBay', ('Airdrop lancé (#%s).'):format(id), 'success')
        cb(resp)
    end, id)
end)

-- ================= Utils models =================
local function reqModel(model)
    local hash = (type(model) == 'string') and GetHashKey(model) or model
    RequestModel(hash)
    local t = GetGameTimer() + 10000
    while not HasModelLoaded(hash) do
        Wait(10)
        if GetGameTimer() > t then break end
    end
    return hash
end

-- ================= Crate management =================
local cratesByOrder = {}   -- [order_uid] = crate entity
local crateTargets  = {}   -- [order_uid] = { type='ox'|'qb'|'e', ref=entity }

-- Event: SPAWN de la caisse qui descend doucement (sans avion)
RegisterNetEvent('onion_airdrop:crate:spawn', function(payload)
    local coords = payload and payload.coords or nil
    local order  = payload and payload.order  or nil
    if not coords or not order then return end

    local A = (Config.BlackBay and Config.BlackBay.Airdrop) or {}
    local dropHeight   = A.DropHeight or 280.0      -- hauteur au-dessus du joueur
    local baseDown     = A.DescentBase or -2.0      -- petite poussée vers le bas si ça “flotte”
    local clampFast    = A.DescentClamp or -9.0     -- vitesse max (négative) de chute “loin du sol”
    local nearGround   = A.DescentNear or 22.0      -- en-dessous → on ralentit encore
    local nearClamp    = A.DescentNearClamp or -2.5 -- vitesse max “près du sol” (très lente)

    local crateHash = reqModel(A.CrateModel or 'ex_prop_crate_ammo_sc')
    local chuteHash = reqModel(A.ParachuteModel or 'p_parachute1_mp_s')

    local spawnZ = (coords.z or GetEntityCoords(PlayerPedId()).z) + dropHeight
    local crate = CreateObject(crateHash, coords.x, coords.y, spawnZ, true, true, true)
    local chute = CreateObject(chuteHash, coords.x, coords.y, spawnZ + 1.0, true, true, true)

    SetEntityAsMissionEntity(crate, true, true)
    SetEntityAsMissionEntity(chute, true, true)
    FreezeEntityPosition(crate, false); SetEntityCollision(crate, true, true)
    SetEntityHasGravity(crate, true); ActivatePhysics(crate); SetEntityDynamic(crate, true)
    FreezeEntityPosition(chute, false); SetEntityCollision(chute, true, true)
    SetEntityHasGravity(chute, true); ActivatePhysics(chute); SetEntityDynamic(chute, true)
    AttachEntityToEntity(chute, crate, 0, 0.0, 0.0, 1.2, 0.0, 0.0, 0.0, false, false, false, false, 2, true)

    cratesByOrder[order] = crate

    -- Descente contrôlée SANS oscillation (clamp de Vz + léger damping horizontal)
    CreateThread(function()
        local landed, tick = false, 0
        while not landed and tick < 2400 do
            Wait(50); tick = tick + 1

            local c = GetEntityCoords(crate)
            local vx, vy, vz = table.unpack(GetEntityVelocity(crate))

            -- Distance au sol
            local ray = StartShapeTestRay(c.x, c.y, c.z, c.x, c.y, c.z - 1000.0, 1, crate, 0)
            local _, hit, endCoords = GetShapeTestResult(ray)
            local dist = 999.0
            if hit == 1 then dist = c.z - endCoords.z end

            -- Choix du clamp actuel (plus lent près du sol)
            local clampNow = (dist < nearGround) and nearClamp or clampFast

            -- 1) Si on tombe plus vite que clampNow, on “cappe” la vitesse (sans pousser vers le haut)
            if vz < clampNow then
                SetEntityVelocity(crate, vx * 0.98, vy * 0.98, clampNow)
            else
                -- 2) Si ça ne descend pas assez, on donne une petite impulsion vers le bas
                if vz > clampNow + 0.3 then
                    ApplyForceToEntityCenterOfMass(crate, 1, 0.0, 0.0, baseDown, true, true, true, true)
                end
                -- Damping horizontal léger pour stabiliser
                SetEntityVelocity(crate, vx * 0.99, vy * 0.99, vz)
            end

            -- 3) Posé ?
            if hit == 1 and dist < 1.5 then
                landed = true
                break
            end
        end

        -- Pose finale
        DetachEntity(chute, true, true)
        if DoesEntityExist(chute) then DeleteEntity(chute) end
        PlaceObjectOnGroundProperly(crate)
        Wait(200)

        -- Interaction (NE PAS despawn ici)
        if GetResourceState('ox_target') == 'started' then
            exports.ox_target:addLocalEntity(crate, {{
                name = 'blackbay_open_crate',
                icon = 'fa-solid fa-box-open',
                label = 'Ouvrir le colis',
                distance = 2.0,
                onSelect = function(_)
                    TriggerServerEvent('onion_airdrop:openCrate', order)
                end
            }})
            crateTargets[order] = { type='ox', ref = crate }
        elseif GetResourceState('qb-target') == 'started' then
            exports['qb-target']:AddTargetEntity(crate, {
                options = {{
                    icon  = 'fa-solid fa-box-open',
                    label = 'Ouvrir le colis',
                    action = function() TriggerServerEvent('onion_airdrop:openCrate', order) end
                }},
                distance = 2.0
            })
            crateTargets[order] = { type='qb', ref = crate }
        else
            crateTargets[order] = { type='e', ref = crate }
            CreateThread(function()
                while DoesEntityExist(crate) do
                    Wait(0)
                    local ped = PlayerPedId()
                    if #(GetEntityCoords(ped) - GetEntityCoords(crate)) < 2.0 then
                        SetTextComponentFormat('STRING'); AddTextComponentString('~INPUT_CONTEXT~ Ouvrir le colis'); DisplayHelpTextFromStringLabel(0,0,1,-1)
                        if IsControlJustPressed(0, 38) then
                            TriggerServerEvent('onion_airdrop:openCrate', order)
                            Wait(300)
                        end
                    end
                end
            end)
        end

        phoneNotify('BlackBay', 'Le colis est au sol. Approche-toi pour l’ouvrir.', 'success')
    end)
end)

-- Ouvrir stash (le serveur a injecté les items)
RegisterNetEvent('onion_airdrop:openStash', function(data)
    local stashId   = data and data.id
    local slots     = (data and data.slots) or (Config.BlackBay and Config.BlackBay.Airdrop and Config.BlackBay.Airdrop.StashMinSlots) or 30
    local maxweight = (data and data.maxweight) or (Config.BlackBay and Config.BlackBay.Airdrop and Config.BlackBay.Airdrop.StashMaxWeight) or 4000000
    if not stashId then return end

    TriggerServerEvent('inventory:server:OpenInventory', 'stash', stashId, { maxweight = maxweight, slots = slots, name = stashId })
    TriggerEvent('inventory:client:SetCurrentStash', stashId)
end)

-- Le serveur indique que le stash est VIDE -> on retire les cibles et on despawn la caisse
RegisterNetEvent('onion_airdrop:crate:despawn', function(data)
    local order = data and data.order
    if not order then return end
    local crate = cratesByOrder[order]
    local tgt   = crateTargets[order]

    if tgt then
        if tgt.type == 'ox' and GetResourceState('ox_target') == 'started' then
            exports.ox_target:removeLocalEntity(tgt.ref)
        elseif tgt.type == 'qb' and GetResourceState('qb-target') == 'started' then
            exports['qb-target']:RemoveTargetEntity(tgt.ref)
        end
    end

    if crate and DoesEntityExist(crate) then DeleteEntity(crate) end
    cratesByOrder[order] = nil
    crateTargets[order]  = nil
end)

RegisterNetEvent('onion_airdrop:claimed', function(_)
    local ok = pcall(function()
        exports['lb-phone']:SendNotification({ app='BlackBay', title='Airdrop', content='Colis prêt (stash ouvert).' })
    end)
    if not ok then TriggerEvent('QBCore:Notify', 'Colis prêt.', 'success') end
end)
