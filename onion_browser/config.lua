Config = Config or {}

Config.ALLACCES = false
Config.BlackBayAppIdentifier = 'Onion'

Config.MaxSalesPerCitizen = 5    -- nb max d'annonces par citizenid
Config.MaxQtyPerSale      = 5    -- quantité max par vente

Config.SalesItems = {
  paintingg    = { title = "Peinture GG",            img = "paintingg.png",    price = 10000 },
  paintingf    = { title = "Peinture GF",            img = "paintingf.png",    price = 10000 },
  diamondbox   = { title = "Boite de diamants",     img = "diamondbox.png",   price = 2000  },
  argentbar    = { title = "Barre d'Argent",        img = "argentbar.png",    price = 1500  },
  vandiamond   = { title = "LeVan Diamond",         img = "vanDiamond.png",   price = 30000 },
  vanpanther   = { title = "LeVan Panther",         img = "vanPanther.png",   price = 30000 },
  vannecklace  = { title = "LeVan Collier",         img = "vanNecklace.png",  price = 30000 },
  vanbottle    = { title = "LeVan Bouteille",       img = "vanBottle.png",    price = 30000 },
  vanpogo      = { title = "LeVan Pogo",            img = "vanPogo.png",      price = 30000 },
  rolex        = { title = "Montre en or",          img = "rolex.png",        price = 5000  },
  diamond_ring = { title = "Bague en diamant",      img = "diamond_ring.png", price = 4500  },
  goldchain    = { title = "Chaîne en or",          img = "goldchain.png",    price = 2500  },
  tenkgoldchain= { title = "Chaîne en or 10 carats",img = "10kgoldchain.png", price = 5000  },
  goldbar      = { title = "Lingot d'or",           img = "goldbar.png",      price = 8000  },
}


Config.DeliveryEligibleMinutes = 5

Config.UseWorldMailboxProps      = true
Config.AllowSpawnMailboxFallback = false
Config.MailboxSearchRadius       = 25.0
Config.Mailboxes = Config.Mailboxes or {}

Config.MailboxZoneRadius = 1.6
Config.MailboxModels = {
  'prop_postbox_01a',
  'prop_letterbox_01',
  'prop_letterbox_02',
  'prop_letterbox_03',
  'prop_letterbox_04',
}

Config.Mailboxes = {
  vector3(116.41, -928.72, 28.84),
  vector3(-162.96, -872.75, 28.25),
  vector3(-232.45, -973.16, 28.31),
  vector3(-29.5, -983.85, 28.3),
  vector3(220.12, -201.39, 52.97),
  vector3(326.33, 167.19, 102.62),
  vector3(-600.12, 248.8, 81.11),
  vector3(-1445.3, -115.64, 49.66),
  vector3(-1294.82, -1162.79, 3.99),

  -- PaletoBay
  vector3(-774.47, 5597.76, 32.62),
  vector3(-678.13, 5833.51, 16.35),
  vector3(-392.63, 6030.36, 30.55),
  vector3(-115.32, 6309.74, 30.49),

  -- SandyShore
  vector3(1676.3, 4872.74, 41.05),
  vector3(1859.83, 3682.37, 32.83),
} 

Config.BlackBayOrdersTable = 'alt_blackbay_orders'

-- Articles SANS vérification de grade (Boss/Second non requis)
-- ⚠️ On normalise en minuscules sans espaces dans le code serveur
Config.BlackBayNoGradeItems = {
  'cutter',
  'drill',
  'saw',            -- (attention: si ton id a un espace "saw " on le trim côté serveur)
  'thermite_bomb',
  'c4_bomb',
  'laptop',
  'trojan_usb',
}