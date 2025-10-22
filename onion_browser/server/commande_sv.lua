local QBCore = exports['qb-core']:GetCoreObject()

local function status_code(s)
  s = (s or ''):lower():gsub('%s+', '_')
  if s == 'pending' or s == 'en_attente_paiement' then s = 'attente_paiement' end
  return s
end

local function sanitizeId(id)
  id = tostring(id or '')
  id = id:gsub('%s+', ''):lower() -- trim espaces + lowercase
  return id
end

-- set "no grade"
local NoGrade = {}
for _, k in ipairs(Config.BlackBayNoGradeItems or {}) do
  NoGrade[sanitizeId(k)] = true
end

local function requiresGrade(cart)
  for _, it in ipairs(cart or {}) do
    local id = sanitizeId(it.id)
    if not NoGrade[id] then
      return true
    end
  end
  return false
end

local function hasBossOrSecond(citizenid)
  local rows = MySQL.query.await('SELECT grade FROM alt_group_members WHERE citizenid = ?', { citizenid })
  if rows and #rows > 0 then
    for _, r in ipairs(rows) do
      local g = (r.grade or ''):lower()
      if g == 'boss' or g == 'second' then
        return true
      end
    end
  end
  return false
end

local function generateOrderNo()
  local d = os.date('*t')
  return string.format('BB-%04d%02d%02d-%02d%02d%02d-%03d',
    d.year, d.month, d.day, d.hour, d.min, d.sec, math.random(0,999))
end

-- Callback QBCore pour placer une commande
QBCore.Functions.CreateCallback('onion:blackbay:placeOrder', function(source, cb, items, total)
  local Player = QBCore.Functions.GetPlayer(source)
  if not Player then cb({ ok=false, error='no_player' }); return end

  items = items or {}
  total = tonumber(total) or 0
  if #items == 0 then cb({ ok=false, error='empty_cart' }); return end

  local citizenid = Player.PlayerData.citizenid
  if requiresGrade(items) and not hasBossOrSecond(citizenid) then
    -- Popup/notification LB-Phone (export officiel)
    exports['lb-phone']:SendNotification(source, {
      app = 'blackbay',
      title = 'Commande refusée',
      content = "Seuls les grades Boss et Second peuvent commander ces articles.",
      customData = { buttons = { { title = "OK" } } }
    })
    cb({ ok=false, error='no_grade' })
    return
  end

  local orderNo = generateOrderNo()
    local ok = MySQL.insert.await(
    ('INSERT INTO %s (order_no, citizenid, items, total, status) VALUES (?,?,?,?,?)')
        :format(Config.BlackBayOrdersTable or 'alt_blackbay_orders'),
    { orderNo, citizenid, json.encode(items), total, 'attente_paiement' }  -- <--
    )

  if not ok then
    cb({ ok=false, error='db_insert_failed' })
    return
  end

  exports['lb-phone']:SendNotification(source, {
    app = 'blackbay',
    title = 'Commande créée',
    content = ('Commande #%s enregistrée.'):format(orderNo),
  })

  cb({ ok=true, order_no=orderNo, status='Attente paiement' })
end)

-- [2] Récup des commandes (si pas déjà ajouté)
QBCore.Functions.CreateCallback('onion:blackbay:getOrders', function(source, cb)
  local Player = QBCore.Functions.GetPlayer(source)
  if not Player then cb({ ok=false }); return end
  local citizenid = Player.PlayerData.citizenid
  local rows = MySQL.query.await(([[
    SELECT order_no, items, total, status, created_at
    FROM %s WHERE citizenid = ? ORDER BY id DESC
  ]]):format(Config.BlackBayOrdersTable or 'alt_blackbay_orders'), { citizenid })

  local list = {}
  for _, r in ipairs(rows or {}) do
    table.insert(list, {
      id = r.order_no,
      date = tostring(r.created_at or ''):gsub(' ', 'T'),
      items = json.decode(r.items or '[]') or {},
      total = tonumber(r.total) or 0,
      status = r.status or 'attente_paiement',
    })
  end
  cb({ ok=true, orders=list })
end)

-- [3] Démarrage mission paiement : choisit une boîte aux lettres configurée
-- Démarrer la mission de paiement (choix d’une boîte aux lettres + retour coords)
QBCore.Functions.CreateCallback('onion:blackbay:startPayment', function(source, cb, orderNo)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then cb({ ok = false, error = 'no_player' }); return end

    if not orderNo or orderNo == '' then
        cb({ ok = false, error = 'bad_order' })
        return
    end

    local citizenid = Player.PlayerData.citizenid
    local tableName = Config.BlackBayOrdersTable or 'alt_blackbay_orders'

    -- Récupère la commande pour ce citizenid
    local row = MySQL.single.await(
        ('SELECT order_no, total, status FROM %s WHERE order_no = ? AND citizenid = ? LIMIT 1')
        :format(tableName),
        { orderNo, citizenid }
    )
    if not row then
        cb({ ok = false, error = 'order_not_found' })
        return
    end

    -- Normalisation du statut
    local function status_code(s)
        s = (s or ''):lower():gsub('%s+', '_')
        if s == 'pending' or s == 'en_attente_paiement' then s = 'attente_paiement' end
        return s
    end

    if status_code(row.status) ~= 'attente_paiement' then
        cb({ ok = false, error = 'not_payable' }) -- déjà payé / mauvais état
        return
    end

    -- Choix de la boîte aux lettres depuis le config
    local boxes = Config.Mailboxes or {}
    if #boxes == 0 then
        cb({ ok = false, error = 'no_mailbox' })
        return
    end

    -- Sélection simple (aléatoire). Si tu préfères la plus proche, on pourra le faire côté client.
    local pick = boxes[math.random(1, #boxes)]
    local mx, my, mz

    -- Supporte plusieurs formats possibles dans le config
    if type(pick) == 'vector3' then
        mx, my, mz = pick.x, pick.y, pick.z
    elseif type(pick) == 'table' then
        if pick.coords and type(pick.coords) == 'vector3' then
            mx, my, mz = pick.coords.x, pick.coords.y, pick.coords.z
        else
            mx = pick.x or pick[1]
            my = pick.y or pick[2]
            mz = pick.z or pick[3]
        end
    end

    if not (mx and my and mz) then
        cb({ ok = false, error = 'bad_mailbox' })
        return
    end

    cb({
        ok = true,
        order   = { id = row.order_no, total = tonumber(row.total) or 0 },
        mailbox = { x = mx + 0.0, y = my + 0.0, z = mz + 0.0 }
    })
end)

-- [4] Dépôt du cash -> update statut "attente_livraison"
QBCore.Functions.CreateCallback('onion:blackbay:depositCash', function(source, cb, orderNo)
  local Player = QBCore.Functions.GetPlayer(source)
  if not Player then cb({ ok=false, error='no_player' }) return end
  local citizenid = Player.PlayerData.citizenid

  local row = MySQL.single.await(
    ('SELECT order_no, total, status FROM %s WHERE order_no = ? AND citizenid = ? LIMIT 1')
      :format(Config.BlackBayOrdersTable or 'alt_blackbay_orders'),
    { orderNo, citizenid }
  )
  if not row then cb({ ok=false, error='order_not_found' }) return end
  if status_code(row.status) ~= 'attente_paiement' then cb({ ok=false, error='already_paid' }) return end

  local need = tonumber(row.total) or 0
  if need <= 0 then cb({ ok=false, error='bad_total' }) return end

  -- SOMME de tout le cash sur toutes les stacks
  local have = 0
  local items = Player.PlayerData.items or {}
  for _, v in pairs(items) do
    if v and v.name == 'cash' then
      have = have + (v.amount or 0)
    end
  end
  if have < need then
    cb({ ok=false, error='not_enough_cash', missing = (need - have) })
    return
  end

  -- Retire en répartissant sur les stacks (pas de slot)
  local removed = Player.Functions.RemoveItem('cash', need)
  if not removed then
    cb({ ok=false, error='remove_failed' })
    return
  end
  if QBCore.Shared and QBCore.Shared.Items and QBCore.Shared.Items['cash'] then
    TriggerClientEvent('inventory:client:ItemBox', source, QBCore.Shared.Items['cash'], 'remove', need)
  end

  local upd = MySQL.update.await(
    ('UPDATE %s SET status = ? WHERE order_no = ?')
      :format(Config.BlackBayOrdersTable or 'alt_blackbay_orders'),
    { 'attente_livraison', orderNo }
  )

  if upd and upd > 0 then
    -- Annonce au client (il relaiera à la NUI si ouverte)
    TriggerClientEvent('onion:blackbay:status', source, orderNo, 'attente_livraison')
    cb({ ok = true, new_status = 'Attente livraison' })
  else
    cb({ ok = false, error = 'db_update_failed' })
  end
end)
