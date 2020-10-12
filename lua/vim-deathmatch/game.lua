local log = require("vim-deathmatch.print")

local states = {
    waitingToStart = 1,
    editing = 2,
    waitingForResults = 3,
}

local Game = {}
local I_AM_SORRY_SOME_CODING_GUY_PLEASE_FORGIVE_ME = "[^%s]+"

local function getTime()
    return vim.fn.reltimefloat(vim.fn.reltime())
end

local function tokenize(str)
    local bucket = {}
    for token in string.gmatch(line, I_AM_SORRY_SOME_CODING_GUY_PLEASE_FORGIVE_ME) do
        table.insert(bucket, token)
    end

    return bucket
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
    self:_writeBuffer(self.bufh[1], "Waiting for server response...")
    self:_writeBuffer(self.bufh[2], "Waiting for server response...")
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

    log.info("Game:_onMessage", msgType, data)
    if msgType == "waiting" then
        self:_clearBuffer(self.bufh[1])
        self:_clearBuffer(self.bufh[2])

        self:_writeBuffer(self.bufh[1], msg.msg)
        self:_writeBuffer(self.bufh[2], msg.msg)

    elseif msgType == "start-game" then
        self:_clearBuffer(self.bufh[1])
        self:_clearBuffer(self.bufh[2])

        self:_writeBuffer(self.bufh[1], msg.startText)
        self:_writeBuffer(self.bufh[2], msg.goalText)

        self.state = states.editing
        self.startText = msg.startText
        self.goalText = tokenize(msg.goalText)

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

function Game:on_buffer_update(id, ...)
    if self.state ~= states.editing then
        return
    end

    local gameText = tokenize(
        vim.api.nvim_buf_get_lines(id, 0, vim.api.nvim_buf_line_count()))
    local idx = 1
    if #gameText ~= #self.goalText then
        return
    end

    local matched = true
    while matched and idx <= #gameText do
        matched = matched and gameText[idx] == self.goalText[idx]
    end

    log.info("Game:on_buffer_update", matched, gameText)
    if matched then
        local msg = vim.fn.json_encode({
        })
        self.channel:send("finished", msg)
    end
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

        vim.api.nvim_buf_attach(self.bufh[1], false, {
            on_lines=function(...) self:on_buffer_update(1, ...) end})

        self.keysPressed = {}

        -- TODO: How to measure undos?
        -- I think they are done in buf attach, we should be able to see the
        -- tick count of the current buffer.
        vim.register_keystroke_callback(function(buf)
            if self.state == states.editing then
                table.insert(self.keysPressed, buf)
            end
        end, vim.fn.nvim_create_namespace("vim-deathmatch"))
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

function Game:_writeBuffer(bufh, msg)
    start = start or 1
    if not self.bufh then
        return
    end

    if type(msg) ~= "table" then
        msg = {msg}
    end

    vim.api.nvim_buf_set_lines(bufh, start, #msg + start, false, msg)
end

local function createEmpty(count)
    local lines = {}
    for idx = 1, count, 1 do
        lines[idx] = ""
    end

    return lines
end

function Game:_clearBuffer(bufh)
    emptyLines = createEmpty(vim.api.nvim_buf_line_count(bufh))
    vim.api.nvim_buf_set_lines(bufh, 1, #emptyLines, false, emptyLines)
end

return Game

