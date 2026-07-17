import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-front',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './front.component.html',
  styleUrl: './front.component.css',
})
export class FrontComponent {}
