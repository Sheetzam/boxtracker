import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { InventoryService } from './services/inventory.service';
import { GeminiService } from './services/gemini.service';
import { Component, signal, computed, Output, EventEmitter } from '@angular/core';
import { By } from '@angular/platform-browser';
import { CameraComponent } from './components/camera.component';

// Declare Jasmine globals to satisfy the compiler in environments without @types/jasmine
declare var describe: any;
declare var beforeEach: any;
declare var it: any;
declare var expect: any;
declare var jasmine: any;
declare var spyOn: any;

// Stub CameraComponent to avoid navigator.mediaDevices issues during testing
@Component({
  selector: 'app-camera',
  standalone: true,
  template: '<div>Mock Camera View</div>'
})
class MockCameraComponent {
  @Output() imageCaptured = new EventEmitter<string>();
  
  capture() {
    // Mock capture method
  }
}

describe('AppComponent Navigation', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let inventoryServiceMock: any;

  beforeEach(async () => {
    // Setup Mock Inventory Service with Signals
    const currentBoxIdSig = signal<string | null>(null);
    const boxesSig = signal([
      { id: 'box-1', name: 'Test Living Room', isFull: false, createdAt: Date.now() }
    ]);
    
    inventoryServiceMock = {
      boxes: boxesSig,
      items: signal([]),
      currentBoxId: currentBoxIdSig,
      // Simulate the computed signal for the current box
      currentBox: computed(() => 
        currentBoxIdSig() ? boxesSig().find(b => b.id === currentBoxIdSig()) : null
      ),
      itemsInCurrentBox: computed(() => []),
      addBox: jasmine.createSpy('addBox'),
      updateBoxStatus: jasmine.createSpy('updateBoxStatus'),
      selectBox: jasmine.createSpy('selectBox'),
      addItem: jasmine.createSpy('addItem')
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: InventoryService, useValue: inventoryServiceMock },
        { 
          provide: GeminiService, 
          useValue: { 
            analyzeItem: async () => {}, 
            searchInventory: async () => [] 
          } 
        }
      ]
    })
    .overrideComponent(AppComponent, {
      // Replace the real camera with the mock to prevent hardware access errors
      remove: { imports: [CameraComponent] },
      add: { imports: [MockCameraComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should toggle navigation buttons based on box selection', () => {
    // 1. Initial State: No box selected (Dashboard View)
    let backButton = fixture.debugElement.query(By.css('button[title="Back to Boxes"]'));
    let exitButton = fixture.debugElement.query(By.css('button.text-gray-500')); // The bottom exit link
    
    expect(backButton).toBeFalsy('Back button should NOT exist on dashboard');
    expect(exitButton).toBeFalsy('Exit button should NOT exist on dashboard');

    // 2. Action: Select a box
    inventoryServiceMock.currentBoxId.set('box-1');
    fixture.detectChanges(); // Trigger Change Detection

    // 3. Verify Box View State
    backButton = fixture.debugElement.query(By.css('button[title="Back to Boxes"]'));
    
    // Check for the bottom exit button specifically by text content to be sure
    const allButtons = fixture.debugElement.queryAll(By.css('button'));
    const foundExitButton = allButtons.find(btn => 
      btn.nativeElement.textContent.includes('Exit Box')
    );

    expect(backButton).toBeTruthy('Back button SHOULD exist when box is open');
    expect(foundExitButton).toBeTruthy('Exit Box button SHOULD exist when box is open');
    
    // Verify the title updated
    const title = fixture.debugElement.query(By.css('h1'));
    expect(title.nativeElement.textContent).toContain('Test Living Room');
  });

  it('should call backToBoxList when back button is clicked', () => {
    // Select box to render button
    inventoryServiceMock.currentBoxId.set('box-1');
    fixture.detectChanges();

    spyOn(component, 'backToBoxList');

    const backButton = fixture.debugElement.query(By.css('button[title="Back to Boxes"]'));
    backButton.nativeElement.click();

    expect(component.backToBoxList).toHaveBeenCalled();
  });
});