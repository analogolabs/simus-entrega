import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationService } from '../../../../core/services/navigation.service';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { HomeStrategiesSectionComponent } from './home-strategies-section.component';

describe('HomeStrategiesSectionComponent', () => {
  let fixture: ComponentFixture<HomeStrategiesSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeStrategiesSectionComponent],
      providers: [
        {
          provide: NavigationService,
          useValue: {
            routerNavigate: jasmine.createSpy('routerNavigate'),
          },
        },
        {
          provide: TextosWebService,
          useValue: { getWebText: () => '', getWebImage: () => '', getWebImageAlt: () => '' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeStrategiesSectionComponent);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('pinta las cinco puertas en dos filas de anchos distintos (8 + 4 y 5 + 3 + 4 columnas)', () => {
    const celdas = fixture.nativeElement.querySelectorAll('ul > li') as NodeListOf<HTMLElement>;
    expect(celdas.length).toBe(5);
    const anchos = Array.from(celdas).map((c) => (c.className.match(/lg:col-span-(\d+)/) ?? [])[1]);
    expect(anchos).toEqual(['8', '4', '5', '3', '4']);
  });

  it('cada celda es un botón que lleva a su página', () => {
    const navegacion = TestBed.inject(NavigationService) as unknown as { routerNavigate: jasmine.Spy };
    (fixture.nativeElement.querySelectorAll('[data-testid="puerta"]')[1] as HTMLButtonElement).click();
    expect(navegacion.routerNavigate).toHaveBeenCalledWith('editorial');
  });
});
