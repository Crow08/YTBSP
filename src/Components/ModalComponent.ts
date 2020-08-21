import $ from 'jquery';
import Component from './Component';

export default class ModalComponent extends Component  {

  modalContent: JQuery;

  constructor(){
    super($("<div/>", {"id": "ytbsp-modal"}));
    this.modalContent = $("<div/>", {"id": "ytbsp-modal-content"});
    this.component.append(this.modalContent);
  }

  // Show backup dialog modal
  openModal(content: JQuery): void {
    if (0 === this.component.length || 0 === this.modalContent.length) {
        throw new Error("could not open modal!");
    }
    this.modalContent.empty();
    this.modalContent.append(content);
    this.component.css("display", "block");
    setTimeout(() => {
      this.component.css("opacity", "1");
    }, 0);
  }

  // Hide backup dialog modal
  closeModal(): void {
    if (0 !== this.component.length) {
      this.component.css("display", "none");
      this.component.css("opacity", "0");
    }
    if(0 === this.modalContent.length) {
      this.modalContent.empty();
    }
  }
}