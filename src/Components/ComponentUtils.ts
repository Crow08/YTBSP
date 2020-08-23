import $ from "jquery";
import Component from "./Component";

export class Slider extends Component {
    private input: JQuery;

    constructor(id: string, checked: boolean, onChange: (event: Event) => void) {
        super($("<label/>", {"class": "ytbsp-slider", "id": id}));
        this.input = $("<input/>", {
            "class": "ytbsp-slider-cb",
            "type": "checkbox",
            "checked": checked,
            "on": {"change": onChange}
        });
        this.component.append(this.input);
        this.component.append($("<div/>", {"class": "ytbsp-slider-rail"}));
        this.component.append($("<div/>", {"class": "ytbsp-slider-knob"}));
    }

    getValue(): boolean {
        return this.input.prop("checked");
    }

    setValue(newValue: boolean): void {
        this.input.prop("checked", newValue);
    }
}

export class Loader extends Component {
    constructor(id: string) {
        super($("<div/>", {"class": "ytbsp-loader", "id": id}));
    }
}

// Universal loader as resource.
const getLoader = (id: string): Loader => {
    return new Loader(id);
};

// Make slider as resource.
const getSlider = (id: string, checked: boolean, onChange: (event: Event) => void): Slider => {
    return new Slider(id, checked, onChange);
};

export { getLoader, getSlider };
