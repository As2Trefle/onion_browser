local QBCore = exports['qb-core']:GetCoreObject()

RegisterNUICallback('bb_copy_os', function(data, cb)
    cb({ ok = false })
end)

RegisterNUICallback('bb_list_all_annonces', function(data, cb)
    QBCore.Functions.TriggerCallback('onion:bb_list_all_annonces', function(rows)
        cb({ ok = true, rows = rows or {} })
    end)
end)

RegisterNUICallback('bb_list_my_annonces', function(data, cb)
    QBCore.Functions.TriggerCallback('onion:bb_list_my_annonces', function(rows)
        cb({ ok = true, rows = rows or {} })
    end)
end)

RegisterNUICallback('bb_create_annonce', function(data, cb)
    local title   = tostring(data.title or ''):gsub('%s+$','')
    local message = tostring(data.message or ''):gsub('%s+$','')
    local contact = tostring(data.contact or ''):gsub('%s+$','')
    local author  = tostring(data.author or ''):gsub('%s+$','')

    if #title == 0 or #title > 20 or
       #message == 0 or #message > 140 or
       #contact == 0 or #contact > 13 or not contact:match('^[0-9 +]+$') or
       #author == 0 or #author > 16 then
        cb({ ok = false, reason = 'invalid_fields' })
        return
    end

    QBCore.Functions.TriggerCallback('onion:bb_create_annonce', function(success, insertId)
        cb({ ok = success and true or false, id = insertId })
    end, {
        title = title, message = message, contact = contact, author = author
    })
end)

RegisterNUICallback('bb_update_annonce', function(data, cb)
    local id = tostring(data.id or data.annonce_id or data.uuid or '')
    if id == '' then cb({ ok = false, reason = 'missing_id' }); return end

    local title   = tostring(data.title or ''):gsub('%s+$','')
    local message = tostring(data.message or ''):gsub('%s+$','')
    local contact = tostring(data.contact or ''):gsub('%s+$','')
    local author  = tostring(data.author or ''):gsub('%s+$','')

    if #title == 0 or #title > 20 or
       #message == 0 or #message > 140 or
       #contact == 0 or #contact > 13 or not contact:match('^[0-9 +]+$') or
       #author == 0 or #author > 16 then
        cb({ ok = false, reason = 'invalid_fields' })
        return
    end

    QBCore.Functions.TriggerCallback('onion:bb_update_annonce', function(success, affected)
        cb({ ok = success and true or false, affected = affected or 0 })
    end, {
        id = id, title = title, message = message, contact = contact, author = author
    })
end)

RegisterNUICallback('bb_delete_annonce', function(data, cb)
    local id = tostring(data.id or data.annonce_id or data.uuid or '')
    if id == '' then cb({ ok = false, reason = 'missing_id' }); return end

    QBCore.Functions.TriggerCallback('onion:bb_delete_annonce', function(success, affected)
        cb({ ok = success and true or false, affected = affected or 0 })
    end, { id = id })
end)
