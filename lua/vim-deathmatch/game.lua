local log = require("vim-deathmatch.print")

local states = {
    waitingToStart = 1,
    editing = 2,
    waitingForResults = 3,
}

local Game = {}

local function getTime()
    return vim.fn.reltimefloat(vim.fn.reltime())
end

function Game:new(channel)
    local gameConfig = {
        channel = channel,
        winId = nil,
        bufh = nil,
    }

    self.__index = self
    local game = setmetatable(gameConfig, self)
    game:_createOrResizeWindow()
    return game
end

function Game:start()
    log.info("Game:start")
    self.channel:setCallback(function(msgType, msg)
        log.info("Game:start#setCallback", msgType, msg)
        self:_onMessage(msgType, msg)
    end)
    self.channel:send("ready")

    self.state = states.waitingToStart
    self:_writeBuffer(self.bufh[1], "Waiting for player....")
    self:_writeBuffer(self.bufh[2], "Waiting for player....")
end

function Game:isWindowId(winId)
    return self.winId[1] == winId or self.winId[2] == winId
end

function Game:onWinClose(winId)
    log.info("onWinClose", winId, self.winId[1], self.winId[2])
    if self:isWindowId(winId) then
        vim.api.nvim_win_close(self.winId[1], true)
        vim.api.nvim_win_close(self.winId[2], true)
    end
end

function Game:_onMessage(msgType, data)
    self:_writeBuffer(self.bufh[2], data)

    local msg = vim.fn.json_decode(data)

    if msgType == "gameStart" then
        self:_clearBuffer(self.bufh[1])
        self:_clearBuffer(self.bufh[2])

        self:_writeBuffer(self.bufh[1], msg.startingText)
        self:_writeBuffer(self.bufh[2], msg.goalText)
    elseif msgType == "finished" then
        self:_clearBuffer(self.bufh[1])
        self:_clearBuffer(self.bufh[2])

        if msg.failed then
            print("FAILED")
            self:_writeBuffer(self.bufh[1], msg.message)
        else
            print("NOT FAILED")
        end
    end
end

function Game:resize()
    self:_createOrResizeWindow()
end

function Game:isRunning()
    return self.bufh ~= nil
end

function Game:_createOrResizeWindow()
    local w = vim.fn.nvim_win_get_width(0)
    local h = vim.fn.nvim_win_get_height(0)

    local width = math.floor(w / 2) - 2
    local height = h - 2
    local rcConfig1 = { row = 1, col = 1 }

    local rcConfig2 = { row = 1, col = width + 2 }

    local config = {
        style = "minimal",
        relative = "win",
        width = width,
        height = height
    }

    if not self.bufh then
        self.bufh = {vim.fn.nvim_create_buf(false, true),
            vim.fn.nvim_create_buf(false, true)}
    end

    if not self.winId then
        self.winId = {
            vim.api.nvim_open_win(self.bufh[1], true,
                vim.tbl_extend("force", config, rcConfig1)),
            vim.api.nvim_open_win(self.bufh[2],
                false, vim.tbl_extend("force", config, rcConfig2)),
        }
        log.info("Game:_createOrResizeWindow: new windows", vim.inspect(self.winId))

    else
        vim.api.nvim_win_set_config(
            self.bufh[1], vim.tbl_extend("force", config, rcConfig1))
        vim.api.nvim_win_set_config(
            self.bufh[2], vim.tbl_extend("force", config, rcConfig2))

    end
end

function Game:_writeBuffer(bufh)
    start = start or 1
    if not self.bufh then
        return
    end

    if type(msg) ~= "table" then
        msg = {msg}
    end

    vim.api.nvim_buf_set_lines(bufh, start, #msg + start, true, msg)
end

function Game:_clearBuffer(bufh)
    vim.cmd("%d")
end

return Game

