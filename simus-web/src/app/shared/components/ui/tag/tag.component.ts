import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tag',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="text-xs inline-block font-bold px-5 py-2 rounded-md font-alternate" [ngClass]="className">
      {{ text }}
    </span>
  `,
  styles: []
})
export class TagComponent {
  @Input() text = '';
  @Input() className = '';
}
