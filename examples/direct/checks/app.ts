/// <reference path="../../../sdk/app.d.ts" />
export {};
app.sleep_until(() => world.is_open(),100,2);
const [major,minor] = app.get_version();
app.set_setting("chunks.load-distance",3);
// @ts-expect-error function is not a setting value
app.set_setting("chunks.load-distance",() => 3);
// @ts-expect-error no graphical application methods in headless app profile
app.focus();
// @ts-expect-error callbacks return a boolean
app.sleep_until(() => "ready");
void [major,minor];
