local APP_IDENTIFIER = 'onion_browser'

CreateThread(function()
    -- Attendre que lb-phone soit démarré (important)
    while GetResourceState('lb-phone') ~= 'started' do
        Wait(200)
    end
    Wait(500) -- petit délai conseillé par la doc

    local res = GetCurrentResourceName()

    local success, err = exports['lb-phone']:AddCustomApp({
        identifier = APP_IDENTIFIER,              -- <— la bonne clé
        name = 'Onion',
        description = 'Navigateur anonyme',
        developer = 'ALT',
        defaultApp = true,                        -- true = app installée d’office
        ui = ("%s/ui/index.html"):format(res),                    -- chemin recommandé par la doc
        icon = ('https://cfx-nui-%s/ui/assets/icon-onion.jpg'):format(res),
        fixBlur = true                            -- autorisé par l’export
        -- (tu peux aussi ajouter images, size, price, landscape, etc. si besoin)
    })

    if success then
        print('[onion_browser] App enregistrée.')
    else
        print(('[onion_browser] Échec AddCustomApp: %s'):format(err or 'unknown'))
    end
end)