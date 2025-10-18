-- ordersv.lua — BlackBay: commandes + airdrop (caisse parachutée)
-- Version sans mapping/validation : les IDs du JSON sont utilisés tels quels.

local QBCore = exports['qb-core']:GetCoreObject()

-- ========= Création tables si besoin =========
CreateThread(function()
    exports.oxmysql:execute([[
        CREATE TABLE IF NOT EXISTS `alt_blackbay_orders` (
          `id` INT NOT NULL AUTO_INCREMENT,
          `order_uid` VARCHAR(64) NOT NULL,
          `chunk_index` INT NOT NULL,
          `citizenid` VARCHAR(64) NOT NULL,
          `items_json` LONGTEXT NOT NULL,
          `items_count` INT NOT NULL,
          `total_amount` INT NOT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
          PRIMARY KEY (`id`),
          KEY `idx_uid` (`order_uid`),
          KEY `idx_citizenid` (`citizenid`)
        )
    ]])
end)

-- ========= Helpers =========
local function buildAlwaysAllowedSets()
    local srcs, ids = {}, {}
    for _, s in ipairs((Config.BlackBay and Config.BlackBay.AlwaysAllowedSources) or {}) do
        srcs[string.lower(s)] = true
    end
    for _, id in ipairs((Config.BlackBay and Config.BlackBay.AlwaysAllowedItemIds) or {}) do
        ids[string.lower(id)] = true
    end
    if Config.BlackBay and Config.BlackBay.AllowSalesItemsWithoutGrade and Config.SalesItems then
        for id, _ in pairs(Config.SalesItems) do ids[string.lower(id)] = true end
    end
    return srcs, ids
end

local function orderIsFullyAlwaysAllowed(items)
    local srcs, ids = buildAlwaysAllowedSets()
    for _, it in ipairs(items or {}) do
        local src = (it.src and string.lower(it.src)) or ''
        local id  = (it.id  and string.lower(it.id))  or ''
        if not srcs[src] and not ids[id] then return false end
    end
    return true
end

local function getMemberGrade(citizenid, cb)
    exports.oxmysql:scalar('SELECT grade FROM alt_group_members WHERE citizenid = ? LIMIT 1', { citizenid }, function(grade)
        cb(grade)
    end)
end

local function countItems(items)
    local n = 0
    for _, it in ipairs(items or {}) do n = n + (tonumber(it.qty) or 0) end
    return n
end

local function calcTotal(items)
    local t = 0
    for _, it in ipairs(items or {}) do
        t = t + ((tonumber(it.price) or 0) * (tonumber(it.qty) or 0))
    end
    return math.floor(t)
end

local function splitByCap(items, cap)
    local chunks, current, left = {}, {}, cap
    for _, it in ipairs(items or {}) do
        local qty = tonumber(it.qty) or 0
        local base = { id = it.id, title = it.title, img = it.img, price = tonumber(it.price) or 0, src = it.src or "unknown" }
        while qty > 0 do
            if left == 0 then table.insert(chunks, current) current = {} left = cap end
            local take = math.min(qty, left)
            local line = {}; for k, v in pairs(base) do line[k] = v end
            line.qty = take
            table.insert(current, line)
            left = left - take
            qty = qty - take
        end
    end
    if #current > 0 then table.insert(chunks, current) end
    return chunks
end

local function makeOrderUID()
    local d = os.date("!*t"); local rnd = math.random(100000, 999999)
    return string.format("BB-%04d%02d%02d-%02d%02d%02d-%d", d.year, d.month, d.day, d.hour, d.min, d.sec, rnd)
end

-- Agrège tous les lots de la commande (somme par id)
local function aggregateLootAsync(order_uid, citizenid, cb)
    exports.oxmysql:execute(
        'SELECT items_json FROM alt_blackbay_orders WHERE order_uid=? AND citizenid=?',
        { order_uid, citizenid },
        function(rows)
            local sums = {}
            for _, r in ipairs(rows or {}) do
                local items = json.decode(r.items_json or "[]") or {}
                for _, it in ipairs(items) do
                    local id  = tostring(it.id or '')
                    local qty = tonumber(it.qty) or 0
                    if id ~= '' and qty > 0 then
                        sums[id] = (sums[id] or 0) + qty
                    end
                end
            end
            local loot = {}
            for name, amount in pairs(sums) do
                table.insert(loot, { name = name, amount = amount })
            end
            cb(loot)
        end
    )
end

-- ========= Création d'une commande =========
QBCore.Functions.CreateCallback('onion_browser:order:attempt', function(source, cb, items, confirmLarge)
    if type(items) ~= 'table' or #items == 0 then return cb({ ok = false, reason = 'empty' }) end
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return cb({ ok = false, reason = 'no_player' }) end
    local citizenid = Player.PlayerData.citizenid
    local cap = (Config.BlackBay and Config.BlackBay.OrderMaxItems) or 100

    local function proceed()
        local totalQty = countItems(items)
        if totalQty > cap and not confirmLarge then
            return cb({ ok = false, reason = 'need_confirm_split', totalQty = totalQty, cap = cap })
        end
        local chunks = (totalQty > cap) and splitByCap(items, cap) or { items }
        local orderUID = makeOrderUID()
        for idx, chunk in ipairs(chunks) do
            exports.oxmysql:insert([[
                INSERT INTO alt_blackbay_orders
                    (order_uid, chunk_index, citizenid, items_json, items_count, total_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            ]], { orderUID, idx, citizenid, json.encode(chunk), countItems(chunk), calcTotal(chunk) })
        end
        cb({ ok = true, order_uid = orderUID, chunks = #chunks })
    end

    if Config.ALLACCES or orderIsFullyAlwaysAllowed(items) then
        return proceed()
    end

    getMemberGrade(citizenid, function(grade)
        local g = grade and string.lower(grade) or nil
        if not g or (g ~= 'boss' and g ~= 'second') then
            return cb({ ok = false, reason = 'not_authorized' })
        end
        proceed()
    end)
end)

-- ========= Lister MES commandes =========
QBCore.Functions.CreateCallback('onion_browser:orders:list', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return cb({}) end
    local citizenid = Player.PlayerData.citizenid

    exports.oxmysql:execute([[
        SELECT order_uid, chunk_index, items_count, total_amount, status, created_at, items_json
        FROM alt_blackbay_orders
        WHERE citizenid = ?
        ORDER BY created_at DESC, id DESC
    ]], { citizenid }, function(rows)
        local out = {}
        for _, r in ipairs(rows or {}) do
            table.insert(out, {
                id = r.order_uid,
                chunk = r.chunk_index,
                count = r.items_count,
                total = r.total_amount,
                status = r.status,
                date = r.created_at,
                items = json.decode(r.items_json or "[]") or {}
            })
        end
        cb(out)
    end)
end)

-- ========= Airdrop simple : SPAWN D'UNE CAISSE AU-DESSUS DU JOUEUR =========
QBCore.Functions.CreateCallback('onion_browser:orders:airdrop:start', function(source, cb, order_uid)
    if type(order_uid) ~= 'string' or order_uid == '' then return cb({ ok = false, reason = 'bad_request' }) end

    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return cb({ ok = false, reason = 'no_player' }) end
    local citizenid = Player.PlayerData.citizenid

    exports.oxmysql:single(
        'SELECT status FROM alt_blackbay_orders WHERE order_uid=? AND citizenid=? ORDER BY id ASC LIMIT 1',
        { order_uid, citizenid },
        function(row)
            if not row then return cb({ ok=false, reason='not_found' }) end
            local status = string.lower(row.status or 'pending')
            if status ~= 'pending' and status ~= 'en attente' then
                return cb({ ok=false, reason='bad_status', status=status })
            end

            -- statut → en cours (tous les lots de la commande)
            exports.oxmysql:update(
                'UPDATE alt_blackbay_orders SET status=? WHERE order_uid=? AND citizenid=? AND (status=? OR status=?)',
                { 'en cours', order_uid, citizenid, 'pending', 'en attente' }
            )

            -- position du joueur
            local ped = GetPlayerPed(source); if ped == 0 then return cb({ ok=false, reason='no_ped' }) end
            local pos = GetEntityCoords(ped)

            -- spawn caisse chez LUI
            TriggerClientEvent('onion_airdrop:crate:spawn', source, {
                coords = { x = pos.x, y = pos.y, z = pos.z },
                order  = order_uid
            })

            cb({ ok=true, minutes=0 })
        end
    )
end)

-- ========= Ouverture de la caisse → PREPARE le stash puis OUVRE =========
RegisterNetEvent('onion_airdrop:openCrate', function(order_uid)
    local src = source
    if type(order_uid) ~= 'string' or order_uid == '' then return end

    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end
    local citizenid = Player.PlayerData.citizenid

    exports.oxmysql:single(
        'SELECT 1 FROM alt_blackbay_orders WHERE order_uid=? AND citizenid=? AND status=? LIMIT 1',
        { order_uid, citizenid, 'en cours' },
        function(row)
            if not row then
                TriggerClientEvent('QBCore:Notify', src, 'Commande invalide ou déjà livrée.', 'error')
                return
            end

            aggregateLootAsync(order_uid, citizenid, function(loot)
                if #loot == 0 then
                    TriggerClientEvent('QBCore:Notify', src, 'Aucun contenu à livrer.', 'error')
                    return
                end

                local stashId = ('airdrop:%s:%s'):format(order_uid, citizenid)

                -- Construire table items au format qb-inventory, SANS validation/mapping
                local items, slot = {}, 1
                for _, it in ipairs(loot) do
                    local name   = tostring(it.name or '')
                    local amount = tonumber(it.amount) or 0
                    if name ~= '' and amount > 0 then
                        items[slot] = {
                            name  = name,               -- utilisé tel quel
                            amount= amount,
                            info  = {},                 -- meta vide par défaut
                            type  = 'item',
                            slot  = slot
                        }
                        slot = slot + 1
                    end
                end

                -- Pré-crée le stash (si supporté), sinon SaveStashItems le créera côté DB
                pcall(function()
                    local weight = (Config.BlackBay and Config.BlackBay.Airdrop and Config.BlackBay.Airdrop.StashMaxWeight) or 4000000
                    local slots  = math.max((Config.BlackBay and Config.BlackBay.Airdrop and Config.BlackBay.Airdrop.StashMinSlots) or 30, slot - 1)
                    TriggerEvent('inventory:server:CreateStash', stashId, weight, slots)
                end)

                -- 1) Sauvegarde le contenu
                TriggerEvent('inventory:server:SaveStashItems', stashId, items)

                -- 2) Mini-délai et OUVERTURE
                SetTimeout(250, function()
                    local slots = math.max((Config.BlackBay and Config.BlackBay.Airdrop and Config.BlackBay.Airdrop.StashMinSlots or 30), slot-1)
                    local weight= (Config.BlackBay and Config.BlackBay.Airdrop and Config.BlackBay.Airdrop.StashMaxWeight or 4000000)
                    TriggerClientEvent('onion_airdrop:openStash', src, { id = stashId, slots = slots, maxweight = weight })
                end)
            end)
        end
    )
end)

-- ========= Quand le stash devient VIDE → statut 'livré' + despawn de la caisse =========
AddEventHandler('inventory:server:SaveStashItems', function(stashId, items)
    if type(stashId) ~= 'string' then return end
    if not stashId:find('^airdrop:') then return end

    local empty = true
    if items and next(items) then
        for _, it in pairs(items) do
            if it and (tonumber(it.amount) or 0) > 0 then empty = false break end
        end
    end
    if not empty then return end

    local order_uid, citizenid = stashId:match('^airdrop:([^:]+):(.+)$')
    if not order_uid or not citizenid then return end

    exports.oxmysql:update(
        'UPDATE alt_blackbay_orders SET status = ? WHERE order_uid = ? AND citizenid = ? AND status = ?',
        { 'livré', order_uid, citizenid, 'en cours' }
    )

    local Player = QBCore.Functions.GetPlayerByCitizenId(citizenid)
    if Player then
        TriggerClientEvent('onion_airdrop:crate:despawn', Player.PlayerData.source, { order = order_uid })
    end
end)
