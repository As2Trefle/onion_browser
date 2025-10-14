local QBCore = exports['qb-core']:GetCoreObject()

local function hasOxMySQL()
    return GetResourceState('oxmysql') == 'started'
end

local function trim(s) return (s or ""):gsub("^%s+", ""):gsub("%s+$", "") end
local function sanitizeContact(s)
    s = trim(s or "")
    if s:find("[^%d +]") then return nil end
    if #s > 13 or #s < 3 then return nil end
    return s
end

-- CREATE
QBCore.Functions.CreateCallback('onion_browser:annonces:create', function(source, cb, data)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then cb(false, 'no_player'); return end

    local citizenid = Player.PlayerData.citizenid
    local title     = trim(data and data.title or "")
    local message   = trim(data and data.message or "")
    local contact   = sanitizeContact(data and data.contact or "")
    local author    = trim(data and data.author or "")

    if title == "" or #title > 20 then cb(false, 'bad_title'); return end
    if message == "" or #message > 140 then cb(false, 'bad_message'); return end
    if not contact then cb(false, 'bad_contact'); return end
    if author == "" or #author > 50 then cb(false, 'bad_author'); return end

    local params = {
        ['citizenid'] = citizenid,
        ['title']     = title,
        ['message']   = message,
        ['contact']   = contact,
        ['author']    = author,
    }

    local sql = [[
        INSERT INTO onion_annonces (citizenid, title, message, contact, author, created_at)
        VALUES (:citizenid, :title, :message, :contact, :author, NOW())
    ]]

    if hasOxMySQL then
        exports.oxmysql:insert(sql, params, function(insertId)
            cb(true, insertId or 0)
        end)
    else
        MySQL.Async.insert(sql, params, function(insertId)
            cb(true, insertId or 0)
        end)
    end
end)

-- LIST MINE
QBCore.Functions.CreateCallback('onion_browser:annonces:listMine', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then cb({ ok = true, rows = {} }); return end

    local citizenid = Player.PlayerData.citizenid
    local sql = [[
        SELECT id, title, message, contact, author,
               UNIX_TIMESTAMP(created_at) AS created_ts
        FROM onion_annonces
        WHERE citizenid = ?
        ORDER BY id DESC
        LIMIT 200
    ]]

    local handler = function(rows)
        cb({ ok = true, rows = rows or {} })
    end

    if hasOxMySQL then
        exports.oxmysql:execute(sql, { citizenid }, handler)
    else
        MySQL.Async.fetchAll(sql, { citizenid }, handler)
    end
end)

-- LIST ALL (flux public)
QBCore.Functions.CreateCallback('onion_browser:annonces:listAll', function(_, cb)
    local sql = [[
        SELECT id, title, message, contact, author,
               UNIX_TIMESTAMP(created_at) AS created_ts
        FROM onion_annonces
        ORDER BY id DESC
        LIMIT 200
    ]]

    local handler = function(rows)
        cb({ ok = true, rows = rows or {} })
    end

    if hasOxMySQL then
        exports.oxmysql:execute(sql, {}, handler)
    else
        MySQL.Async.fetchAll(sql, {}, handler)
    end
end)
