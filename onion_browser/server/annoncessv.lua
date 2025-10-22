local QBCore = exports['qb-core']:GetCoreObject()

local WEBHOOK_URL    = 'https://discord.com/api/webhooks/1427807387460436168/kmW2x2NYRL2gL-56WykcA1UiM33BkFTDxGDmSJfObO_Kodln_M9oC5rvOZhw2Em7p6zi'
local WEBHOOK_NAME   = 'BlackBay • Annonces'
local WEBHOOK_DEBUG  = true

local function logDbg(...)
    if WEBHOOK_DEBUG then
        print('[onion_browser][webhook]', ...)
    end
end

local HAS_GHMA  = GetResourceState('ghmattimysql') == 'started'
local HAS_MYSQL = type(MySQL) == 'table'

local function db_query(sql, params, cb)
    cb = cb or function(_) end
    if HAS_MYSQL then
        MySQL.query(sql, params or {}, cb)
    elseif HAS_GHMA then
        exports['ghmattimysql']:execute(sql, params or {}, cb)
    else
        print('[onion_browser] Aucune DB détectée.')
        cb({})
    end
end

local function db_insert(sql, params, cb)
    cb = cb or function(_) end
    if HAS_MYSQL and MySQL.insert then
        MySQL.insert(sql, params or {}, cb)
    elseif HAS_GHMA then
        exports['ghmattimysql']:execute(sql, params or {}, function()
            exports['ghmattimysql']:scalar('SELECT LAST_INSERT_ID()', {}, function(id)
                cb(id)
            end)
        end)
    else
        print('[onion_browser] Aucune DB détectée.')
        cb(nil)
    end
end

local function db_update(sql, params, cb)
    cb = cb or function(_) end
    if HAS_MYSQL and MySQL.update then
        MySQL.update(sql, params or {}, function(affected) cb(tonumber(affected) or 0) end)
    elseif HAS_GHMA then
        exports['ghmattimysql']:execute(sql, params or {}, function(result)
            local affected = 0
            if type(result) == 'table' and result.affectedRows then affected = tonumber(result.affectedRows) or 0 end
            cb(affected)
        end)
    else
        print('[onion_browser] Aucune DB détectée.')
        cb(0)
    end
end

CreateThread(function()
    db_query([[
        CREATE TABLE IF NOT EXISTS `onion_annonces` (
          `id` INT NOT NULL AUTO_INCREMENT,
          `citizenid` VARCHAR(50) NOT NULL,
          `title` VARCHAR(20) NOT NULL,
          `message` VARCHAR(140) NOT NULL,
          `contact` VARCHAR(13) NOT NULL,
          `author` VARCHAR(16) NOT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `citizenid_idx` (`citizenid`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]], {})
end)

local function _trim(s) return (tostring(s or ''):gsub('^%s+',''):gsub('%s+$','')) end

local function isValid(d)
    local t = _trim(d.title);   if #t == 0 or #t > 20  then return false end
    local m = _trim(d.message); if #m == 0 or #m > 140 then return false end
    local c = _trim(d.contact); if #c == 0 or #c > 13 or not c:match('^[0-9 +]+$') then return false end
    local a = _trim(d.author);  if #a == 0 or #a > 16  then return false end
    return true
end

local function rpName(Player)
    local info = (Player.PlayerData and Player.PlayerData.charinfo) or {}
    local fn = info.firstname or info.firstName or info.first_name or ''
    local ln = info.lastname  or info.lastName  or info.last_name  or ''
    fn = tostring(fn); ln = tostring(ln)
    local n = (fn .. ' ' .. ln):gsub('^%s*(.-)%s*$', '%1')
    if n == '' then n = (Player.PlayerData and Player.PlayerData.name) or 'N/A' end
    return n
end

local function nowFR()
    return os.date('%d/%m/%Y %H:%M:%S')
end
local function toFRDate(val)
    if val == nil then return '-' end
    if type(val) == 'number' then
        if val > 1e12 then val = math.floor(val / 1000) end -- ms -> s
        return os.date('%d/%m/%Y %H:%M:%S', val)
    elseif type(val) == 'string' then
        local Y,M,D,h,m,s = val:match('^(%d+)%-(%d+)%-(%d+)%s+(%d+):(%d+):(%d+)$')
        if Y then
            local ts = os.time({ year=tonumber(Y), month=tonumber(M), day=tonumber(D),
                                 hour=tonumber(h), min=tonumber(m), sec=tonumber(s) })
            if ts then return os.date('%d/%m/%Y %H:%M:%S', ts) end
        end
        return val
    end
    return tostring(val)
end

local function sendDiscord(payload)
    if type(WEBHOOK_URL) ~= 'string' or WEBHOOK_URL == '' then
        logDbg('Webhook non configuré — envoi annulé.')
        return
    end

    payload.allowed_mentions = { parse = {} }

    local jsonBody = json.encode(payload)
    logDbg('POST webhook…', 'len=' .. tostring(#jsonBody))

    PerformHttpRequest(
        WEBHOOK_URL,
        function(code, body, headers)
            logDbg('Webhook HTTP code:', tostring(code))
            if code ~= 204 and code ~= 200 then
                logDbg('Réponse Discord:', body or 'nil')
            end
        end,
        'POST',
        jsonBody,
        {
            ['Content-Type'] = 'application/json',
            ['Accept']       = 'application/json'
        }
    )
end

local function sendAnnonceLog(kind, Player, rowNew, rowOld)
    local actionLabel = (kind == 'create' and 'Ajout')
                     or (kind == 'update' and 'Modification')
                     or (kind == 'delete' and 'Suppression')
                     or 'Action'
    local colors = { create = 0xF39C12, update = 0x2980B9, delete = 0xE74C3C }
    local color  = colors[kind] or 0x2D3436

    local citizenid = (Player.PlayerData and Player.PlayerData.citizenid) or 'N/A'
    local nameRP    = rpName(Player)

    local id        = tostring((rowNew and rowNew.id) or (rowOld and rowOld.id) or 'N/A')
    local title     = (rowNew and rowNew.title)   or (rowOld and rowOld.title)   or '-'
    local message   = (rowNew and rowNew.message) or (rowOld and rowOld.message) or '-'
    local contact   = (rowNew and rowNew.contact) or (rowOld and rowOld.contact) or '-'
    local author    = (rowNew and rowNew.author)  or (rowOld and rowOld.author)  or '-'
    local createdAt = toFRDate((rowNew and rowNew.created_at) or (rowOld and rowOld.created_at))

    local embed = {
        title = ('BlackBay — %s d\'annonce'):format(actionLabel),
        color = color,
        footer = { text = 'Onion Browser • ' .. nowFR() },
        fields = {
            { name = 'CitizenID',        value = tostring(citizenid), inline = true },
            { name = 'Nom RP',           value = tostring(nameRP),    inline = true },
            { name = 'ID annonce',       value = tostring(id),        inline = true },
            { name = 'Titre',            value = tostring(title),     inline = false },
            { name = 'Message',          value = tostring(message),   inline = false },
            { name = 'Contact',          value = tostring(contact),   inline = true },
            { name = 'Auteur (pseudo)',  value = tostring(author),    inline = true },
            { name = 'Publiée le',       value = tostring(createdAt), inline = true },
        }
    }

    if kind == 'update' and rowOld then
        local avant = ('Titre: %s\nMessage: %s\nContact: %s\nAuteur: %s')
            :format(tostring(rowOld.title or '-'), tostring(rowOld.message or '-'),
                    tostring(rowOld.contact or '-'), tostring(rowOld.author or '-'))
        table.insert(embed.fields, { name = 'Avant', value = avant, inline = false })
    end

    sendDiscord({
        content = '',
        embeds  = { embed },
    })
end

QBCore.Functions.CreateCallback('onion:bb_create_annonce', function(source, cb, data)
    local P = QBCore.Functions.GetPlayer(source)  if not P then cb(false) return end
    if not isValid(data) then cb(false, 'invalid_fields') return end

    local params = {
        P.PlayerData.citizenid, _trim(data.title), _trim(data.message),
        _trim(data.contact), _trim(data.author)
    }
    db_insert([[
        INSERT INTO onion_annonces (citizenid, title, message, contact, author)
        VALUES (?, ?, ?, ?, ?)
    ]], params, function(insertId)
        local ok = insertId ~= nil
        cb(ok, insertId)
        if ok then
            local row = {
                id = insertId,
                title = _trim(data.title),
                message = _trim(data.message),
                contact = _trim(data.contact),
                author = _trim(data.author),
                created_at = nowFR()
            }
            logDbg('LOG create id=' .. tostring(insertId))
            sendAnnonceLog('create', P, row, nil)
        end
    end)
end)

QBCore.Functions.CreateCallback('onion:bb_update_annonce', function(source, cb, data)
    local P = QBCore.Functions.GetPlayer(source)  if not P then cb(false) return end
    local id = tonumber(data.id) or tonumber(data.annonce_id) or tonumber(data.uuid)
    if not id then cb(false, 'missing_id') return end
    if not isValid(data) then cb(false, 'invalid_fields') return end

    db_query([[
        SELECT id, title, message, contact, author,
               DATE_FORMAT(created_at, '%d/%m/%Y %H:%i:%s') AS created_at
          FROM onion_annonces
         WHERE id = ? AND citizenid = ? LIMIT 1
    ]], { id, P.PlayerData.citizenid },
    function(rowsOld)
        local rowOld = rowsOld and rowsOld[1] or nil

        db_update([[
            UPDATE onion_annonces
               SET title = ?, message = ?, contact = ?, author = ?
             WHERE id = ? AND citizenid = ?
        ]], { _trim(data.title), _trim(data.message), _trim(data.contact), _trim(data.author), id, P.PlayerData.citizenid },
        function(affected)
            if affected and affected > 0 then
                cb(true, affected)
                local rowNew = {
                    id = id,
                    title = _trim(data.title),
                    message = _trim(data.message),
                    contact = _trim(data.contact),
                    author = _trim(data.author),
                    created_at = rowOld and rowOld.created_at or '-'
                }
                logDbg('LOG update id=' .. tostring(id) .. ' affected=' .. tostring(affected))
                sendAnnonceLog('update', P, rowNew, rowOld)
            else
                if rowOld then
                    cb(true, 0)
                    local rowNew = {
                        id = id,
                        title = _trim(data.title),
                        message = _trim(data.message),
                        contact = _trim(data.contact),
                        author = _trim(data.author),
                        created_at = rowOld.created_at
                    }
                    logDbg('LOG update (no change) id=' .. tostring(id))
                    sendAnnonceLog('update', P, rowNew, rowOld)
                else
                    cb(false, 0)
                end
            end
        end)
    end)
end)

QBCore.Functions.CreateCallback('onion:bb_delete_annonce', function(source, cb, data)
    local P = QBCore.Functions.GetPlayer(source)  if not P then cb(false) return end
    local id = tonumber(data.id) or tonumber(data.annonce_id) or tonumber(data.uuid)
    if not id then cb(false, 'missing_id') return end

    db_query([[
        SELECT id, title, message, contact, author,
               DATE_FORMAT(created_at, '%d/%m/%Y %H:%i:%s') AS created_at
          FROM onion_annonces
         WHERE id = ? AND citizenid = ? LIMIT 1
    ]], { id, P.PlayerData.citizenid },
    function(rowsOld)
        local rowOld = rowsOld and rowsOld[1] or nil
        db_update('DELETE FROM onion_annonces WHERE id = ? AND citizenid = ?',
            { id, P.PlayerData.citizenid },
            function(affected)
                local ok = affected > 0
                cb(ok, affected)
                if ok then
                    logDbg('LOG delete id=' .. tostring(id) .. ' affected=' .. tostring(affected))
                    if rowOld then sendAnnonceLog('delete', P, nil, rowOld) end
                end
            end)
    end)
end)

QBCore.Functions.CreateCallback('onion:bb_list_all_annonces', function(_, cb)
    db_query([[
        SELECT id, title, message, contact, author,
               DATE_FORMAT(created_at, '%d/%m/%Y %H:%i:%s') AS created_at
          FROM onion_annonces
         ORDER BY created_at DESC
         LIMIT 200
    ]], {}, function(rows) cb(rows or {}) end)
end)

QBCore.Functions.CreateCallback('onion:bb_list_my_annonces', function(source, cb)
    local P = QBCore.Functions.GetPlayer(source)  if not P then cb({}) return end
    db_query([[
        SELECT id, title, message, contact, author,
               DATE_FORMAT(created_at, '%d/%m/%Y %H:%i:%s') AS created_at
          FROM onion_annonces
         WHERE citizenid = ?
         ORDER BY created_at DESC
         LIMIT 200
    ]], { P.PlayerData.citizenid }, function(rows) cb(rows or {}) end)
end)

RegisterCommand('bb_ann_logtest', function(src, args)
    if src ~= 0 then return end
    local fakePlayer = {
        PlayerData = {
            citizenid = 'TESTCITZ-123',
            name = 'Console',
            charinfo = { firstname = 'Dev', lastname = 'Console' }
        }
    }
    local row = {
        id = 999,
        title = 'Annonce Test',
        message = 'Ceci est un test webhook.',
        contact = '0600000000',
        author = 'Tester',
        created_at = nowFR()
    }
    logDbg('Commande bb_ann_logtest exécutée.')
    sendAnnonceLog('create', fakePlayer, row, nil)
end, true)
