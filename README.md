## Warning

This is only for the real vim users and everyone knows, NeoVim is the only vim.

### VIM DEATHMATCH

The greatest 1v1 experience since the CoD gulag. Get ready to strap in and
execute the sweetest and sweatiest vim motions, commands, replaces, and
removals. You got this, except when you dont

### Getting Started

Simply install this amazing _NeoVim_ plugin with your favorite installer, I
like plug personally.

Once installed simply execute

```viml
:VimDeathmatch
```

And await the greatest editing experience of your life.

### TODO:

- Finish testing the game. (typescript, theprimeagen)
- Finish the client (lua, theprimeagen)
  - including creating uuids for new players
- The server
  - create game objects and ensure proper logs
  - a resiliant server to crashes (may need to restart itself).
  - Never docker'd, but is this a good idea?
  - Storing winner / loser data. Should we keep stats?
    - what level of stats sholud we keep?
  - Replaying games to ensure that what the user sent up actually represents
    solving the puzzle. And there is no cheating.
- Logging Game actions (emit events) (typescript and lua)
- Replay from logs
  - Lua player log should be able to play a single player
  - Server logs should be able to play both players
  - Should be able to search through logs via uuids (player identifications).
- Random puzzle generator (typescript).

#### TODO If I really feel like it...

- Should we create a website for this?
  - How do we link players to their uuid?
  - public uuid vs private? That way a public uuid can show stats and not leak
    its credentials.
  - Score board?
