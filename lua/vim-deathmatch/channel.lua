local log = require("vim-deathmatch.print")

local states = {
    waitingForLength = 1,
    waitingForType = 2,
    waitingForData = 3,
}

local Channel = {}

function Channel:new()
    self.__index = self
    local channel = setmetatable({
        idx = 0,
        state = states.waitingForLength,
        temporaryContents = nil,
    }, self)

    return channel
end

function Channel:setCallback(cb)
    self.callback = cb
end

local function format(data, msgType)
    local formattedData = string.format(":%s:%s", msgType, data)
    return tostring(#formattedData) .. formattedData
end

function Channel:send(data, msgType)
    if self.channelId == nil then
        log.info("Attempting to send message when channelId is nil", data, msgType)
        return
    end

    msgType = msgType or "msg"

    if type(data) == "table" then
        data = vim.fn.json_encode(data)
    end

    local dataOut = {format(data, msgType)}
    log.info("Channel:send", dataOut)
    vim.fn.chansend(self.channelId, dataOut)
end

function Channel:onMessage(channelId, data, messageType)
    log.info("Channel:onMessage", self.channelId, data)
    if self.channelId == nil then
        return
    end

    self:processMessage(data)
end


function Channel:store(data)
    if self.temporaryContents then
        data = self.temporaryContents .. data
    end

    self.temporaryContents = data
    return data
end

function Channel:get(data)
    if self.temporaryContents then
        data = self.temporaryContents .. data
        self.temporaryContents = nil
    end
    return data
end

function Channel:getStoredMessageLength()
    if self.temporaryContents then
        return #self.temporaryContents
    end
    return 0
end

function Channel:processMessageToLength(data, idx, total)
    log.info("processMessageToLength", data, idx, total)
    local remaining = total - self:getStoredMessageLength()
    if #data >= remaining then
        return true, remaining, self:get(data:sub(idx, #data))
    end
    return false, #data - idx, self:store(data:sub(idx, #data))
end

function Channel:processMessageToToken(data, idx, token)
    log.info("processMessageToToken", idx, token, data)
    local endIdx = string.find(data, ":", idx, true)
    log.info("processMessageToToken endIdx", endIdx)

    if endIdx == nil then
        log.info("processMessageToToken unableToFindToken")
        self:store(data)
        return false, #data - idx
    end

    local consumedAmount = (endIdx - idx) + 1
    log.info("processMessageToToken consumedAmount", consumedAmount)
    local token = self:get(data:sub(idx, endIdx - 1))
    log.info("processMessageToToken token", token)

    return true, consumedAmount, token
end

function Channel:processMessage(data)
    local currentIdx = 1

    while currentIdx <= #data do
        log.info("processMessage:", currentIdx, #data)

        if self.state == states.waitingForLength then
            log.info("processMessage#waitingForLength")
            local completed, consumedAmount, token =
                self:processMessageToToken(data, currentIdx, ":")

            currentIdx = currentIdx + consumedAmount
            log.info("processMessage#waitingForLength", completed, currentIdx, consumedAmount, token)

            if completed then
                self.currentMsgLength = tonumber(token)
                self.state = states.waitingForType
            end

        elseif self.state == states.waitingForType then
            local completed, consumedAmount, token =
                self:processMessageToToken(data, currentIdx, ":")

            currentIdx = currentIdx + consumedAmount

            log.info("processMessage#waitingForType", completed, currentIdx, consumedAmount, token)
            if completed then
                self.currentMsgType = token
                self.state = states.waitingForData
            end

        elseif self.state == states.waitingForData then
            local completed, consumedAmount, token =
                self:processMessageToLength(data, currentIdx, self.currentMsgLength)

            log.info("processMessage#waitingForData", completed, currentIdx, consumedAmount, token)
            if completed then
                local msgType = self.currentMsgType

                self.currentMsgType = nil
                self.currentMsgLength = nil

                currentIdx = currentIdx + consumedAmount
                if self.callback ~= nil then
                    self.callback(msgType, token)
                end

                self.state = states.waitingForLength
            end
        else
            log.info("Error we found ourself in a weird state?????", self.state)
        end
    end
end

function Channel:onWinClose()
    if self.channelId == nil then
        return
    end
    vim.fn.chanclose(self.channelId)
    self.channelId = nil
end

function Channel:open(address, callback)
    local self = self
    local channelId = vim.fn.sockconnect("tcp", address, {
        on_data = function(chanId, data, messageType)
            for idx = 1, #data do
                log.info("Channel:open:on_data", data[idx])
                self:onMessage(chanId, data[idx], messageType)
            end
        end
    })

    self.channelId = channelId
end

return Channel


