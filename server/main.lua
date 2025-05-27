local QBCore = exports['qb-core']:GetCoreObject()
local OutsideVehicles = {}
local VehicleHistory = {}

-- Create vehicle history table if it doesn't exist
MySQL.ready(function()
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `vehicle_history` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `plate` varchar(50) NOT NULL,
            `type` varchar(50) NOT NULL,
            `title` varchar(255) NOT NULL,
            `description` varchar(255) NOT NULL,
            `time` varchar(50) NOT NULL,
            `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `plate` (`plate`)
        )
    ]])
    
    -- Create vehicle maintenance table if it doesn't exist
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `vehicle_maintenance` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `plate` varchar(50) NOT NULL,
            `last_service` timestamp NULL DEFAULT NULL,
            `next_service` timestamp NULL DEFAULT NULL,
            `service_interval` int(11) DEFAULT 10000,
            `notes` text,
            PRIMARY KEY (`id`),
            UNIQUE KEY `plate` (`plate`)
        )
    ]])
end)

-- Function to add vehicle history entry
local function AddVehicleHistory(plate, historyType, title, description)
    local time = os.date('%Y-%m-%d %H:%M')
    MySQL.insert('INSERT INTO vehicle_history (plate, type, title, description, time) VALUES (?, ?, ?, ?, ?)',
        {plate, historyType, title, description, time})
end

-- Handler

AddEventHandler('onResourceStart', function(resource)
    if resource == GetCurrentResourceName() then
        Wait(100)
        if Config['AutoRespawn'] then
            MySQL.update('UPDATE player_vehicles SET state = 1 WHERE state = 0', {})
        else
            MySQL.update('UPDATE player_vehicles SET depotprice = 500 WHERE state = 0', {})
        end
    end
end)

-- Functions

local vehicleClasses = {
    compacts = 0,
    sedans = 1,
    suvs = 2,
    coupes = 3,
    muscle = 4,
    sportsclassics = 5,
    sports = 6,
    super = 7,
    motorcycles = 8,
    offroad = 9,
    industrial = 10,
    utility = 11,
    vans = 12,
    cycles = 13,
    boats = 14,
    helicopters = 15,
    planes = 16,
    service = 17,
    emergency = 18,
    military = 19,
    commercial = 20,
    trains = 21,
    openwheel = 22,
}

local function arrayToSet(array)
    local set = {}
    for _, item in ipairs(array) do
        set[item] = true
    end
    return set
end

local function filterVehiclesByCategory(vehicles, category)
    local filtered = {}
    local categorySet = arrayToSet(category)

    for _, vehicle in pairs(vehicles) do
        local vehicleData = QBCore.Shared.Vehicles[vehicle.vehicle]
        local vehicleCategoryString = vehicleData and vehicleData.category or 'compacts'
        local vehicleCategoryNumber = vehicleClasses[vehicleCategoryString]

        if vehicleCategoryNumber and categorySet[vehicleCategoryNumber] then
            filtered[#filtered + 1] = vehicle
        end
    end

    return filtered
end

-- Callbacks

-- Get vehicle history
QBCore.Functions.CreateCallback('alpha-garages:server:GetVehicleHistory', function(source, cb, plate)
    local result = MySQL.query.await('SELECT * FROM vehicle_history WHERE plate = ? ORDER BY timestamp DESC LIMIT ?', {plate, Config.HistoryLimit})
    if result and #result > 0 then
        cb(result)
    else
        cb({})
    end
end)

-- Repair vehicle
QBCore.Functions.CreateCallback('alpha-garages:server:RepairVehicle', function(source, cb, plate)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    local cash = Player.PlayerData.money.cash
    local bank = Player.PlayerData.money.bank
    local repairCost = 1000 -- Base repair cost
    
    -- Get vehicle info to calculate repair cost
    local vehicleData = MySQL.query.await('SELECT * FROM player_vehicles WHERE plate = ?', {plate})
    if vehicleData and vehicleData[1] then
        local engineDamage = 1000 - (vehicleData[1].engine or 1000)
        local bodyDamage = 1000 - (vehicleData[1].body or 1000)
        
        -- Calculate repair cost based on damage
        repairCost = math.floor((engineDamage * 1.5) + (bodyDamage * 0.5))
        if repairCost < 100 then repairCost = 100 end -- Minimum repair cost
        
        -- Check if player can afford repair
        if cash >= repairCost then
            Player.Functions.RemoveMoney('cash', repairCost, "vehicle-repair")
            
            -- Update vehicle
            MySQL.update('UPDATE player_vehicles SET engine = ?, body = ? WHERE plate = ?', {1000, 1000, plate})
            
            -- Add to history
            AddVehicleHistory(plate, 'repair', 'Vehicle Repaired', 'Vehicle was repaired for $' .. repairCost)
            
            cb({success = true, cost = repairCost})
        elseif bank >= repairCost then
            Player.Functions.RemoveMoney('bank', repairCost, "vehicle-repair")
            
            -- Update vehicle
            MySQL.update('UPDATE player_vehicles SET engine = ?, body = ? WHERE plate = ?', {1000, 1000, plate})
            
            -- Add to history
            AddVehicleHistory(plate, 'repair', 'Vehicle Repaired', 'Vehicle was repaired for $' .. repairCost)
            
            cb({success = true, cost = repairCost})
        else
            cb({success = false, reason = "Not enough money", cost = repairCost})
        end
    else
        cb({success = false, reason = "Vehicle not found"})
    end
end)

QBCore.Functions.CreateCallback('alpha-garages:server:getHouseGarage', function(_, cb, house)
    local houseInfo = MySQL.single.await('SELECT * FROM houselocations WHERE name = ?', { house })
    cb(houseInfo)
end)

QBCore.Functions.CreateCallback('alpha-garages:server:GetGarageVehicles', function(source, cb, garage, type, category)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return end
    local citizenId = Player.PlayerData.citizenid

    local vehicles

    if type == 'depot' then
        vehicles = MySQL.rawExecute.await('SELECT * FROM player_vehicles WHERE citizenid = ? AND depotprice > 0', { citizenId })
    elseif Config.SharedGarages then
        vehicles = MySQL.rawExecute.await('SELECT * FROM player_vehicles WHERE citizenid = ?', { citizenId })
    else
        vehicles = MySQL.rawExecute.await('SELECT * FROM player_vehicles WHERE citizenid = ? AND garage = ?', { citizenId, garage })
    end
    if #vehicles == 0 then
        cb(nil)
        return
    end
    if Config.ClassSystem then
        local filteredVehicles = filterVehiclesByCategory(vehicles, category)
        cb(filteredVehicles)
    else
        cb(vehicles)
    end
end)

-- Backwards Compat
local vehicleTypes = { -- https://docs.fivem.net/natives/?_0xA273060E
    motorcycles = 'bike',
    boats = 'boat',
    helicopters = 'heli',
    planes = 'plane',
    submarines = 'submarine',
    trailer = 'trailer',
    train = 'train'
}

local function GetVehicleTypeByModel(model)
    local vehicleData = QBCore.Shared.Vehicles[model]
    if not vehicleData then return 'automobile' end
    local category = vehicleData.category
    local vehicleType = vehicleTypes[category]
    return vehicleType or 'automobile'
end
-- Backwards Compat

-- Spawns a vehicle and returns its network ID and properties.
QBCore.Functions.CreateCallback('alpha-garages:server:spawnvehicle', function(source, cb, plate, vehicle, coords)
    local vehType = QBCore.Shared.Vehicles[vehicle] and QBCore.Shared.Vehicles[vehicle].type or GetVehicleTypeByModel(vehicle)
    local veh = CreateVehicleServerSetter(GetHashKey(vehicle), vehType, coords.x, coords.y, coords.z, coords.w)
    local netId = NetworkGetNetworkIdFromEntity(veh)
    SetVehicleNumberPlateText(veh, plate)
    local vehProps = {}
    local result = MySQL.rawExecute.await('SELECT mods FROM player_vehicles WHERE plate = ?', { plate })
    if result and result[1] then vehProps = json.decode(result[1].mods) end
    OutsideVehicles[plate] = { netID = netId, entity = veh }
    cb(netId, vehProps, plate)
end)

-- Checks if a vehicle can be spawned based on its type and location.
QBCore.Functions.CreateCallback('alpha-garages:server:IsSpawnOk', function(_, cb, plate, type)
    if OutsideVehicles[plate] and DoesEntityExist(OutsideVehicles[plate].entity) then
        cb(false)
        return
    end
    cb(true)
end)

QBCore.Functions.CreateCallback('alpha-garages:server:canDeposit', function(source, cb, plate, type, garage, state)
    local Player = QBCore.Functions.GetPlayer(source)
    local isOwned = MySQL.scalar.await('SELECT citizenid FROM player_vehicles WHERE plate = ? LIMIT 1', { plate })
    if isOwned ~= Player.PlayerData.citizenid then
        cb(false)
        return
    end
    if type == 'house' and not exports['qb-houses']:hasKey(Player.PlayerData.license, Player.PlayerData.citizenid, Config.Garages[garage].houseName) then
        cb(false)
        return
    end
    if state == 1 then
        MySQL.update('UPDATE player_vehicles SET state = ?, garage = ? WHERE plate = ?', { state, garage, plate })
        cb(true)
    else
        cb(false)
    end
end)

-- Events

RegisterNetEvent('alpha-garages:server:updateVehicleStats', function(plate, fuel, engine, body)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end
    MySQL.update('UPDATE player_vehicles SET fuel = ?, engine = ?, body = ? WHERE plate = ? AND citizenid = ?', { fuel, engine, body, plate, Player.PlayerData.citizenid })
end)

RegisterNetEvent('alpha-garages:server:updateVehicleState', function(state, plate)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end
    MySQL.update('UPDATE player_vehicles SET state = ?, depotprice = ? WHERE plate = ? AND citizenid = ?', { state, 0, plate, Player.PlayerData.citizenid })
end)

RegisterNetEvent('alpha-garages:server:UpdateOutsideVehicle', function(plate, vehicleNetID)
    OutsideVehicles[plate] = {
        netID = vehicleNetID,
        entity = NetworkGetEntityFromNetworkId(vehicleNetID)
    }
end)

RegisterNetEvent('alpha-garages:server:trackVehicle', function(plate)
    local src = source
    local vehicleData = OutsideVehicles[plate]
    if vehicleData and DoesEntityExist(vehicleData.entity) then
        TriggerClientEvent('alpha-garages:client:trackVehicle', src, GetEntityCoords(vehicleData.entity))
        TriggerClientEvent('QBCore:Notify', src, Lang:t('success.vehicle_tracked'), 'success')
    else
        TriggerClientEvent('QBCore:Notify', src, Lang:t('error.vehicle_not_tracked'), 'error')
    end
end)

RegisterNetEvent('alpha-garages:server:PayDepotPrice', function(data)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    local cashBalance = Player.PlayerData.money['cash']
    local bankBalance = Player.PlayerData.money['bank']
    MySQL.scalar('SELECT depotprice FROM player_vehicles WHERE plate = ?', { data.plate }, function(result)
        if result then
            local depotPrice = result

            if cashBalance >= depotPrice then
                Player.Functions.RemoveMoney('cash', depotPrice, 'paid-depot')
                TriggerClientEvent('alpha-garages:client:takeOutGarage', src, data)
            elseif bankBalance >= depotPrice then
                Player.Functions.RemoveMoney('bank', depotPrice, 'paid-depot')
                TriggerClientEvent('alpha-garages:client:takeOutGarage', src, data)
            else
                TriggerClientEvent('QBCore:Notify', src, Lang:t('error.not_enough'), 'error')
            end
        end
    end)
end)

-- House Garages

RegisterNetEvent('alpha-garages:server:syncGarage', function(updatedGarages)
    Config.Garages = updatedGarages
end)

--Call from qb-phone

QBCore.Functions.CreateCallback('alpha-garages:server:GetPlayerVehicles', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    local Vehicles = {}

    MySQL.rawExecute('SELECT * FROM player_vehicles WHERE citizenid = ?', { Player.PlayerData.citizenid }, function(result)
        if result[1] then
            for _, v in pairs(result) do
                local VehicleData = QBCore.Shared.Vehicles[v.vehicle]

                local VehicleGarage = Lang:t('error.no_garage')
                if v.garage ~= nil then
                    if Config.Garages[v.garage] ~= nil then
                        VehicleGarage = Config.Garages[v.garage].label
                    else
                        VehicleGarage = Lang:t('info.house')
                    end
                end

                local stateTranslation
                if v.state == 0 then
                    stateTranslation = Lang:t('status.out')
                elseif v.state == 1 then
                    stateTranslation = Lang:t('status.garaged')
                elseif v.state == 2 then
                    stateTranslation = Lang:t('status.impound')
                end

                local fullname
                if VehicleData and VehicleData['brand'] then
                    fullname = VehicleData['brand'] .. ' ' .. VehicleData['name']
                else
                    fullname = VehicleData and VehicleData['name'] or 'Unknown Vehicle'
                end

                Vehicles[#Vehicles + 1] = {
                    fullname = fullname,
                    brand = VehicleData and VehicleData['brand'] or '',
                    model = VehicleData and VehicleData['name'] or '',
                    plate = v.plate,
                    garage = VehicleGarage,
                    state = stateTranslation,
                    fuel = v.fuel,
                    engine = v.engine,
                    body = v.body
                }
            end
            cb(Vehicles)
        else
            cb(nil)
        end
    end)
end)

local function getAllGarages()
    local garages = {}
    for k, v in pairs(Config.Garages) do
        garages[#garages + 1] = {
            name = k,
            label = v.label,
            type = v.type,
            takeVehicle = v.takeVehicle,
            putVehicle = v.putVehicle,
            spawnPoint = v.spawnPoint,
            showBlip = v.showBlip,
            blipName = v.blipName,
            blipNumber = v.blipNumber,
            blipColor = v.blipColor,
            vehicle = v.vehicle
        }
    end
    return garages
end

exports('getAllGarages', getAllGarages)
