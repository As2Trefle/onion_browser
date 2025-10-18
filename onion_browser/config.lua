-- config.lua — BlackBay / onion_browser (COMPLET)
-- Mode actuel : airdrop SANS avion — une caisse parachutée tombe au-dessus du joueur.
-- Ce fichier gère aussi la VITESSE de DESCENTE du colis.

Config = {}

-- Bypass complet de la vérification de grade (utile en dev)
Config.ALLACCES = false

-- Items "Marché" autorisés à l'achat sans vérification Boss/Second
Config.SalesItems = {
    cutter        = true,
    drill         = true,
    saw           = true,   -- (corrigé: pas d’espace)
    thermite_bomb = true,
    c4_bomb       = true,
    laptop        = true,
    trojan_usb    = true,

    -- Exemples d’items de revente (si tu les utilises)
    paintingg     = true,
    paintingf     = true,
    diamondbox    = true,
    argentbar     = true,
    vandiamond    = true,
    vanpanther    = true,
    vannecklace   = true,
    vanbottle     = true,
    vanpogo       = true,
    rolex         = true,
    diamond_ring  = true,
    goldchain     = true,
    tenkgoldchain = true,
    goldbar       = true,
}

Config.BlackBay = {
    -- Nombre max d’items par lot (les commandes sont automatiquement split si > cap)
    OrderMaxItems = 100,

    -- Sources/Items toujours autorisés (contournent la vérification de grade)
    AllowSalesItemsWithoutGrade = true,
    AlwaysAllowedSources = { 'marche' }, -- la page Marché
    AlwaysAllowedItemIds = { },          -- ajoute ici des ids d’items autorisés globalement

    -- Section Airdrop (CAISSE SEULE, pas d’avion)
    Airdrop = {
        -- Modèles de la caisse et du parachute
        CrateModel     = 'ex_prop_crate_ammo_sc',
        ParachuteModel = 'p_parachute1_mp_s',

        -- INVENTAIRE (stash qb-inventory) ouvert à l’ouverture de la caisse
        StashMinSlots  = 30,
        StashMaxWeight = 4000000, -- 4,000,000

        -- ===== Gestion de la DESCENTE (lent et haut) =====
        -- Hauteur d’apparition de la caisse par rapport à la position du joueur (en mètres)
        DropHeight   = 280.0,

        -- Force verticale appliquée en continu vers le bas (négative = descend).
        -- Valeur faible (ex: -2.0) = descente lente ; plus négative = plus vite.
        DescentBase  = -2.0,

        -- Vitesse de chute maximale (clamp) : si la vitesse verticale (vz) devient inférieure à cette valeur,
        -- on applique un frein vers le haut. Exemple: -9.0 = ne pas dépasser ~9 m/s vers le bas.
        DescentClamp = -9.0,

        DescentNearClamp = -2.5,

        -- Distance du sol (en mètres) à partir de laquelle on freine encore un peu plus pour un posé propre.
        DescentNear  = 22.0,
    },
}
