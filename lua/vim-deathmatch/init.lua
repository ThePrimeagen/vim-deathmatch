local Channel = require("vim-deathmatch.channel")
local Game = require("vim-deathmatch.game")

channel = channel or nil
game = game or nil

local function onWinClose(winId)
    winId = tonumber(winId)

    if game and game:isWindowId(winId) then
        game:onWinClose(winId)
        channel:onWinClose(winId)
    end
end

local function start()
    channel = Channel:new(function(data)
        print("Data", data)
    end)

    channel:open("127.0.0.1:42069")
    game = Game:new(channel)
    game:start()
end

return {
    onWinClose = onWinClose,
    start = start
}

