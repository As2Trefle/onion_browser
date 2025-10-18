local QBCore = exports['qb-core']:GetCoreObject()

-- Retourne true si le joueur a accès au BlackBay > Armes
QBCore.Functions.CreateCallback('onion_browser:checkBlackBayAccess', function(source, cb, tab, sub)
    if Config.ALLACCES then
        return cb(true)
    end

    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return cb(false) end
    local cid = Player.PlayerData.citizenid

    exports.oxmysql:scalar(
        [[
        SELECT g.group_type
        FROM alt_group_members m
        JOIN alt_groups g ON g.id = m.group_id
        WHERE m.citizenid = ?
        LIMIT 1
        ]],
        { cid },
        function(group_type)
            if not group_type then return cb(false) end

            if tab == 'armes' then
                return cb(group_type == 'mafia')
            elseif tab == 'drogues' then
                if group_type == 'cartel' then
                    return cb(true)                   -- cartel: accès total
                elseif group_type == 'biker' then
                    return cb(sub == 'meth')          -- biker: seulement Meth
                else
                    return cb(false)
                end
            else
                return cb(true) -- autres onglets non restreints
            end
        end
    )
end)
