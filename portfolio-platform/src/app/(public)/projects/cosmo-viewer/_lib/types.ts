/**
 * TypeScript types for COSMO Objekt Viewer
 */

export type ObjektAttribute = {
  trait_type: string
  value: string
}

export type ObjektMetadata = {
  name: string
  description: string
  image: string
  attributes: ObjektAttribute[]
}

export type Objekt = {
  tokenId: string
  owner: string
  metadata: ObjektMetadata
}

export type CollectionStats = {
  totalObjekts: number
  comoVotingPower: number
  byMember: Record<string, number>
  bySeason: Record<string, number>
  byClass: Record<string, number>
}

export type Member =
  | 'NaKyoung'
  | 'SoHyun'
  | 'YuBin'
  | 'Kotone'
  | 'SeoYeon'
  | 'HyeRin'
  | 'JiWoo'
  | 'ChaeYeon'
  | 'YooYeon'
  | 'SooMin'
  | 'JiYeon'
  | 'DaHyun'
  | 'Nien'
  | 'Kaede'
  | 'Mayu'
  | 'Lynn'
  | 'JooBin'
  | 'HaYeon'
  | 'ShiOn'
  | 'ChaeWon'
  | 'SulLin'
  | 'SeoAh'
  | 'JiSoo'
  | 'Kim Lip'
  | 'HeeJin'
  | 'HaSeul'
  | 'JinSoul'
  | 'ChoEr'
  | string // Allow other members

export type Season = 'Atom01' | 'Binary01' | 'Cream01' | 'Divine01' | string

export type ObjektClass =
  | '000Z'
  | '100Z'
  | '200Z'
  | '300Z'
  | '316Z'
  | 'FIRST'
  | 'DOUBLE'
  | 'SPECIAL'
  | string
