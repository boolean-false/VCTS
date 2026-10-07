local core = require("vcts:core")
function on_open() core.mount_panel(document) end
function on_close() core.close_panel(true) end
function action(index) core.click(index) end
function close_panel() core.close_panel(false) end
