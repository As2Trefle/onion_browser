local QBCore = exports['qb-core']:GetCoreObject()
local WEBHOOK_START   = 'https://discord.com/api/webhooks/1428144627172638871/YReRymbMWooDXRa-wF3YrjP-wl6JbXJC5Mfn7KQAZ_AZFECLTqLv0-cBrGsRmqauyozO'
local WEBHOOK_FINISH  = 'https://discord.com/api/webhooks/1428145424660697141/HAbsnXr3qtHP76KeFNzDHot3yCEyRR176xO7hTkaOG79OD364zYRYK3Az_f-fB_PDnRd'
local WEBHOOK_ERRORS  = 'https://discord.com/api/webhooks/1428148971326410883/vwyrJpV4rvszAoPxMTqNMshl6bP6N3wYPwTnG18uUXkTKYm7Euc_25NA7PZDcDjbvO9r'

local function frNow() return os.date('%d/%m/%Y %H:%M:%S') end

local function fmtUSD(n)
    n = tonumber(n) or 0
    local s = tostring(math.floor(n))
    local rev = string.reverse(s)
    rev = rev:gsub("(%d%d%d)", "%1,")
    rev = string.reverse(rev):gsub("^,", "")
    return ("USD $%s"):format(rev)
end

local function sendDiscord(url, title, desc, fields, color)
    local embeds = {{
        title = title,
        description = desc or "",
        color = color or 16753920,
        fields = fields or {},
        footer = { text = "BlackBay" },
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }}
    PerformHttpRequest(url, function() end, "POST", json.encode({ embeds = embeds }), { ["Content-Type"] = "application/json" })
end

local function sendStart(fields, desc)  sendDiscord(WEBHOOK_START,  "🚚 Mission BlackBay démarrée", desc,  fields, 16753920) end
local function sendFinish(fields, desc) sendDiscord(WEBHOOK_FINISH, "✅ Livraison BlackBay terminée", desc, fields, 3066993) end
local function sendErrorLog(title, fields, desc) sendDiscord(WEBHOOK_ERRORS, title or "❌ Erreur mission BlackBay", desc, fields, 15158332) end -- rouge

local function rpName(Player)
    local info = (Player.PlayerData and Player.PlayerData.charinfo) or {}
    local fn = info.firstname or info.firstName or info.first or ""
    local ln = info.lastname  or info.lastName  or info.last  or ""
    local name = (fn .. " " .. ln):gsub("%s+", " "):gsub("^%s*(.-)%s*$", "%1")
    if name == "" then name = (Player.PlayerData and (Player.PlayerData.name or Player.PlayerData.charName)) or GetPlayerName(Player.PlayerData.source) or ("ID "..tostring(Player.PlayerData.source)) end
    return name
end

local ActiveMissions = {}
local MissionBySrc   = {}

local function now() return os.time() end
local function minutes(n) return (tonumber(n) or 0) * 60 end
local function getEligibilitySeconds() return minutes((Config and Config.DeliveryEligibleMinutes) or 5) end

local function isEligibleRow(r)
    local created  = tonumber(r.created_ts  or 0) or 0
    local cooldown = tonumber(r.cooldown_ts or 0) or 0
    local base = math.max(created, cooldown)
    return (now() - base) >= getEligibilitySeconds()
end

local function isActive(v) return v == 1 or v == "1" or v == true end

local function asVec4(entry)
    if entry == nil then return vec4(0.0, 0.0, 0.0, 0.0) end
    if entry.x and entry.y and entry.z then
        return vec4(entry.x + 0.0, entry.y + 0.0, entry.z + 0.0, entry.w and (entry.w + 0.0) or 0.0)
    end
    if type(entry) == 'table' and entry.coords and entry.coords.x then
        local c = entry.coords
        return vec4(c.x + 0.0, c.y + 0.0, c.z + 0.0, c.w and (c.w + 0.0) or 0.0)
    end
    return vec4(0.0, 0.0, 0.0, 0.0)
end

local function selectEligibleSaleForCitizen(citizenid)
    local rows = MySQL.query.await(
        'SELECT id, item, qty, price, created_ts, active, cooldown_ts FROM blackbay_sales WHERE citizenid = ? ORDER BY id DESC',
        { citizenid }
    ) or {}
    if #rows == 0 then return rows end

    for _, r in ipairs(rows) do
        if isActive(r.active) then
            return rows
        end
    end

    local nowTs = now()
    local threshold = getEligibilitySeconds()
    local eligible = {}
    for _, r in ipairs(rows) do
        local base = math.max(tonumber(r.created_ts or 0), tonumber(r.cooldown_ts or 0))
        if (nowTs - base) >= threshold then
            eligible[#eligible + 1] = r
        end
    end
    if #eligible == 0 then
        return rows
    end

    local pick = eligible[math.random(1, #eligible)]
    MySQL.update.await(
        'UPDATE blackbay_sales SET active = CASE WHEN id = ? THEN 1 ELSE 0 END, cooldown_ts = CASE WHEN id = ? THEN cooldown_ts ELSE ? END WHERE citizenid = ?',
        { pick.id, pick.id, nowTs, citizenid }
    )

    rows = MySQL.query.await(
        'SELECT id, item, qty, price, created_ts, active, cooldown_ts FROM blackbay_sales WHERE citizenid = ? ORDER BY id DESC',
        { citizenid }
    ) or {}
    return rows
end

QBCore.Functions.CreateCallback('onion:bb_list_my_sales', function(src, cb)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then cb({}); return end
    local citizenid = Player.PlayerData.citizenid
    cb(selectEligibleSaleForCitizen(citizenid))
end)

QBCore.Functions.CreateCallback('onion:bb_create_sale', function(src, cb, item, qty)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then cb({ ok=false, reason='no_player' }); return end

    item = type(item) == 'string' and item or ''
    if item == '' or not Config.SalesItems[item] then
        cb({ ok=false, reason='invalid_item' }); return
    end

    qty = tonumber(qty or 1) or 1
    if qty < 1 then qty = 1 end
    if Config.MaxQtyPerSale and qty > Config.MaxQtyPerSale then
        qty = Config.MaxQtyPerSale
    end

    local citizenid = Player.PlayerData.citizenid
    local count = MySQL.scalar.await('SELECT COUNT(*) FROM blackbay_sales WHERE citizenid = ?', { citizenid }) or 0
    if Config.MaxSalesPerCitizen and count >= Config.MaxSalesPerCitizen then
        cb({ ok=false, reason='limit_reached' }); return
    end

    local have = (Player.Functions.GetItemByName(item) or {}).amount or 0
    if have < qty then
        cb({ ok=false, reason='inventory_missing' }); return
    end

    local price = tonumber(Config.SalesItems[item].price or 0) or 0
    MySQL.insert.await(
        'INSERT INTO blackbay_sales (citizenid, item, qty, price, created_ts, active, cooldown_ts) VALUES (?, ?, ?, ?, ?, 0, 0)',
        { citizenid, item, qty, price, now() }
    )

    cb({ ok = true })
end)

QBCore.Functions.CreateCallback('onion:bb_delete_sale', function(src, cb, saleId)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then cb({ ok=false, reason='no_player' }); return end
    saleId = tonumber(saleId or 0) or 0
    if saleId <= 0 then cb({ ok=false, reason='bad_id' }); return end

    local citizenid = Player.PlayerData.citizenid
    local m = ActiveMissions[citizenid]
    if m and m.sale_id == saleId then
        cb({ ok=false, reason='mission_running' }); return
    end

    local row = MySQL.single.await('SELECT id FROM blackbay_sales WHERE id = ? AND citizenid = ?', { saleId, citizenid })
    if not row then cb({ ok=false, reason='not_found' }); return end

    MySQL.prepare.await('DELETE FROM blackbay_sales WHERE id = ? AND citizenid = ?', { saleId, citizenid })
    cb({ ok=true })
end)

QBCore.Functions.CreateCallback('onion:bb_start_delivery', function(src, cb, saleId)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then cb({ ok=false, reason='no_player' }); return end

    saleId = tonumber(saleId or 0) or 0
    if saleId <= 0 then cb({ ok=false, reason='bad_id' }); return end

    local citizenid = Player.PlayerData.citizenid
    if ActiveMissions[citizenid] then
        cb({ ok=false, reason='mission_running' })
        sendErrorLog("❌ Démarrage mission refusé",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "mission_running", inline=true },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    local row = MySQL.single.await(
        'SELECT id, item, qty, price, created_ts, active, cooldown_ts FROM blackbay_sales WHERE id = ? AND citizenid = ?',
        { saleId, citizenid }
    )
    if not row then
        cb({ ok=false, reason='not_found' })
        sendErrorLog("❌ Démarrage mission refusé",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "not_found (saleId: "..saleId..")", inline=true },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    if not isActive(row.active) then
        if not isEligibleRow(row) then
            cb({ ok=false, reason='not_active' })
            sendErrorLog("❌ Démarrage mission refusé",
                {
                    { name="CitizenID", value = citizenid, inline=true },
                    { name="Nom RP", value = rpName(Player), inline=true },
                    { name="Raison", value = "not_active (non éligible)", inline=true },
                    { name="Item", value = row.item.." ×"..(row.qty or 0), inline=false },
                },
                ("Date: **%s**"):format(frNow())
            )
            return
        end
        MySQL.update.await(
            'UPDATE blackbay_sales SET active = CASE WHEN id = ? THEN 1 ELSE 0 END, cooldown_ts = CASE WHEN id = ? THEN cooldown_ts ELSE ? END WHERE citizenid = ?',
            { saleId, saleId, now(), citizenid }
        )
        row = MySQL.single.await(
            'SELECT id, item, qty, price, created_ts, active, cooldown_ts FROM blackbay_sales WHERE id = ? AND citizenid = ?',
            { saleId, citizenid }
        )
        if not row or not isActive(row.active) then
            cb({ ok=false, reason='activate_failed' })
            sendErrorLog("❌ Démarrage mission refusé",
                {
                    { name="CitizenID", value = citizenid, inline=true },
                    { name="Nom RP", value = rpName(Player), inline=true },
                    { name="Raison", value = "activate_failed", inline=true },
                    { name="Item", value = row and (row.item.." ×"..(row.qty or 0)) or ("saleId: "..saleId), inline=false },
                },
                ("Date: **%s**"):format(frNow())
            )
            return
        end
    end

    local have = (Player.Functions.GetItemByName(row.item) or {}).amount or 0
    if have < tonumber(row.qty or 0) then
        cb({ ok=false, reason='not_enough_items' })
        sendErrorLog("❌ Démarrage mission refusé",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "not_enough_items (have "..tostring(have).."/ need "..tostring(row.qty or 0)..")", inline=false },
                { name="Item", value = row.item, inline=true },
                { name="Quantité requise", value = tostring(row.qty or 0), inline=true },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    local list = Config.Mailboxes or {}
    if not list or #list == 0 then
        cb({ ok=false, reason='no_mailboxes' })
        sendErrorLog("❌ Démarrage mission refusé",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "no_mailboxes (Config vide)", inline=false },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end
    local coords = asVec4(list[math.random(1, #list)])

    ActiveMissions[citizenid] = { sale_id = row.id, item = row.item, qty = row.qty, price = row.price, coords = coords }
    MissionBySrc[src] = citizenid

    cb({ ok = true, mission = { sale_id = row.id, coords = { x = coords.x, y = coords.y, z = coords.z, w = coords.w or 0.0 } } })

    local unitPrice = row.price or (Config.SalesItems[row.item] and Config.SalesItems[row.item].price) or 0
    local total     = unitPrice * (row.qty or 1)
    local charname  = rpName(Player)
    local label     = (Config.SalesItems[row.item] and (Config.SalesItems[row.item].title or Config.SalesItems[row.item].label)) or row.item

    sendStart({
        { name = "CitizenID",   value = citizenid, inline = true },
        { name = "Nom RP",      value = charname,  inline = true },
        { name = "Item",        value = string.format("**%s** (`%s`)", label, row.item), inline = false },
        { name = "Quantité",    value = tostring(row.qty or 0), inline = true },
        { name = "Prix unité",  value = fmtUSD(unitPrice), inline = true },
        { name = "Total prévu", value = fmtUSD(total), inline = true },
    }, ("Date: **%s**"):format(frNow()))
end)

RegisterNetEvent('onion:delivery_cancel', function(saleId, why)
    local src = source
    local cid = MissionBySrc[src]
    if not cid then return end
    ActiveMissions[cid] = nil
    MissionBySrc[src] = nil

    local Player = QBCore.Functions.GetPlayer(src)
    if Player then
        sendErrorLog("ℹ️ Mission annulée par le client",
            {
                { name="CitizenID", value = cid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = tostring(why or "unknown"), inline=false },
            },
            ("Date: **%s**"):format(frNow())
        )
    end
end)

RegisterNetEvent('onion:delivery_lock_coords', function(saleId, x, y, z, h)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src); if not Player then return end
    local citizenid = Player.PlayerData.citizenid
    local m = ActiveMissions[citizenid]
    if not m or m.sale_id ~= tonumber(saleId or 0) then return end
    m.coords = vec4(tonumber(x) or 0.0, tonumber(y) or 0.0, tonumber(z) or 0.0, tonumber(h) or 0.0)
end)

RegisterNetEvent('onion:delivery_finish', function(saleId)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src); if not Player then return end
    saleId = tonumber(saleId or 0) or 0
    local citizenid = Player.PlayerData.citizenid

    local m = ActiveMissions[citizenid]
    if not m or m.sale_id ~= saleId then
        TriggerClientEvent('onion:delivery_done', src, false, 'no_mission')
        sendErrorLog("❌ Livraison échouée",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "no_mission", inline=true },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    local ped = GetPlayerPed(src)
    local pcoords = GetEntityCoords(ped)
    local radius = (Config and Config.MailboxZoneRadius) or 1.6
    local dist = #(pcoords - vec3(m.coords.x, m.coords.y, m.coords.z))
    if dist > (radius + 2.0) then
        TriggerClientEvent('onion:delivery_done', src, false, 'too_far')
        sendErrorLog("❌ Livraison échouée",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "too_far ("..string.format("%.1fm", dist)..")", inline=false },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    local have = (Player.Functions.GetItemByName(m.item) or {}).amount or 0
    if have < tonumber(m.qty or 0) then
        TriggerClientEvent('onion:delivery_done', src, false, 'not_enough_items')
        sendErrorLog("❌ Livraison échouée",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "not_enough_items (have "..tostring(have).."/ need "..tostring(m.qty or 0)..")", inline=false },
                { name="Item", value = m.item, inline=true },
                { name="Quantité requise", value = tostring(m.qty or 0), inline=true },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    local amountCash = (tonumber(m.price or 0) or 0) * (tonumber(m.qty or 0) or 1)
    if amountCash <= 0 then
        TriggerClientEvent('onion:delivery_done', src, false, 'bad_amount')
        sendErrorLog("❌ Livraison échouée",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "bad_amount ("..tostring(amountCash)..")", inline=false },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    local canCarry = true
    if QBCore.Functions.CanCarryItem then
        canCarry = QBCore.Functions.CanCarryItem(src, 'cash', amountCash)
    elseif exports['qb-inventory'] and exports['qb-inventory'].CanAddItem then
        canCarry = exports['qb-inventory']:CanAddItem(src, 'cash', amountCash)
    end
    if not canCarry then
        TriggerClientEvent('onion:delivery_done', src, false, 'no_space')
        sendErrorLog("❌ Livraison échouée",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "no_space (inventaire plein)", inline=false },
                { name="Cash à donner", value = fmtUSD(amountCash), inline=true },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    if not Player.Functions.RemoveItem(m.item, m.qty) then
        TriggerClientEvent('onion:delivery_done', src, false, 'remove_failed')
        sendErrorLog("❌ Livraison échouée",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "remove_failed (impossible de retirer l'item)", inline=false },
                { name="Item", value = m.item, inline=true },
                { name="Quantité", value = tostring(m.qty or 0), inline=true },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end
    if not Player.Functions.AddItem('cash', amountCash) then
        Player.Functions.AddItem(m.item, m.qty)
        TriggerClientEvent('onion:delivery_done', src, false, 'add_cash_failed')
        sendErrorLog("❌ Livraison échouée",
            {
                { name="CitizenID", value = citizenid, inline=true },
                { name="Nom RP", value = rpName(Player), inline=true },
                { name="Raison", value = "add_cash_failed (rollback effectué)", inline=false },
                { name="Cash", value = fmtUSD(amountCash), inline=true },
            },
            ("Date: **%s**"):format(frNow())
        )
        return
    end

    MySQL.prepare.await('DELETE FROM blackbay_sales WHERE id = ? AND citizenid = ?', { m.sale_id, citizenid })

    MySQL.update.await('UPDATE blackbay_sales SET active = 0, cooldown_ts = ? WHERE citizenid = ?', { now(), citizenid })

    local charname = rpName(Player)
    local label = (Config.SalesItems[m.item] and (Config.SalesItems[m.item].title or Config.SalesItems[m.item].label)) or m.item
    sendFinish({
        { name="CitizenID",    value = citizenid, inline=true },
        { name="Nom RP",       value = charname,  inline=true },
        { name="Item vendu",   value = string.format("**%s** (`%s`)", label, m.item), inline=false },
        { name="Retiré (qty)", value = tostring(m.qty or 0), inline=true },
        { name="Prix unité",   value = fmtUSD(m.price or 0), inline=true },
        { name="Total",        value = fmtUSD(amountCash), inline=true },
        { name="Cash donné",   value = fmtUSD(amountCash), inline=true },
    }, ("Date: **%s**"):format(frNow()))

    ActiveMissions[citizenid] = nil
    MissionBySrc[src] = nil
    TriggerClientEvent('onion:delivery_done', src, true)
end)

AddEventHandler('playerDropped', function(reason)
    local src = source
    local citizenid = MissionBySrc[src]
    if not citizenid then return end

    local m = ActiveMissions[citizenid]
    ActiveMissions[citizenid] = nil
    MissionBySrc[src] = nil

    local Player = QBCore.Functions.GetPlayer(src)
    local name = Player and rpName(Player) or ("src:"..tostring(src))

    sendErrorLog("🛑 Crash/Déconnexion pendant mission",
        {
            { name="CitizenID", value = citizenid, inline=true },
            { name="Nom RP",    value = name,      inline=true },
            { name="Raison",    value = tostring(reason or "unknown"), inline=false },
            m and { name="Item", value = (m.item.." ×"..(m.qty or 0)), inline=false } or nil,
        },
        ("Date: **%s**"):format(frNow())
    )
end)
