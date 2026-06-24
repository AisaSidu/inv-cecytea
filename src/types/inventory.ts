export type EquipmentStatus = 'available' | 'assigned' | 'maintenance' | 'retired'

export type MovementType = 'entry' | 'transfer' | 'checkout' | 'return' | 'maintenance'

export interface Station {
  id: string
  name: string
  location: string
  responsibleUser?: string
  createdAt: string
  updatedAt: string
}

export interface Equipment {
  id: string
  stationId: string
  assetTag: string
  name: string
  category: string
  brand?: string
  model?: string
  serialNumber?: string
  status: EquipmentStatus
  qrCode?: string
  createdAt: string
  updatedAt: string
}

export interface Movement {
  id: string
  equipmentId: string
  fromStationId?: string
  toStationId?: string
  type: MovementType
  notes?: string
  performedBy: string
  performedAt: string
}

export interface InventorySummary {
  totalEquipment: number
  activeStations: number
  availableEquipment: number
  equipmentInMaintenance: number
}
