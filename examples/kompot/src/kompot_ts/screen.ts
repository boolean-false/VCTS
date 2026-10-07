import * as K from "kompot:kompot";
import * as UI from "kompot:ui";
export let disposed = 0;
export let observed = 0;
export const Screen = K.component(() => {
    const count = K.state(0);
    const form = K.form({name: "Danila", filter: ""});
    K.effect(() => { observed = count.value; }, count.value);
    K.on_dispose(() => { disposed++; });
    UI.Panel({title: "Kompot + TypeScript", modifier: K.M.width(440)}, () => {
        K.Column({spacing: 8, modifier: K.M.padding(12)}, () => {
            K.Text(`Привет, ${form.name.value}!`);
            UI.TextField({value: form.name.value, hint: "Имя", on_change: text => { form.name.value = text; }});
            UI.Button({text: `Нажато: ${count.value}`, variant: "primary", on_click: () => { count.update(value => value + 1); }});
            UI.TextField({value: form.filter.value, hint: "Фильтр списка", on_change: text => { form.filter.value = text; }});
            for (const name of ["Rails", "Signals", "Kompot"]) {
                if (name.toLowerCase().includes(form.filter.value.toLowerCase())) {
                    K.key(name, () => { K.Text(name); });
                }
            }
        });
    });
});
K.preview("TS форма и состояние", {width: 480, height: 420, theme: UI.theme}, Screen);
