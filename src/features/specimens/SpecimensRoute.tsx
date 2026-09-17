import { PageHead } from '@/components/layout/PageHead'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/primitives'
import { PrimitiveGallery } from './PrimitiveGallery'
import { ShapesSheet } from './ShapesSheet'
import { StatusStates } from './StatusStates'
import { TokenSheet } from './TokenSheet'
import styles from './specimens.module.css'

/**
 * The design reference: tokens, primitives and evidence treatments, drawn by
 * the components themselves so a Figma import of this page is an import of
 * what every screen uses.
 */
export function SpecimensRoute() {
  return (
    <div className={styles.page}>
      <PageHead
        title="Specimens"
        lines={[
          'Every token, primitive, shape and evidence state',
          'rendered by the code the screens use',
        ]}
      />
      <Tabs defaultValue="shapes">
        <TabsList>
          <TabsTrigger value="shapes">Shapes</TabsTrigger>
          <TabsTrigger value="states">Evidence states</TabsTrigger>
          <TabsTrigger value="primitives">Primitives</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>
        <TabsContent value="shapes">
          <ShapesSheet />
        </TabsContent>
        <TabsContent value="states">
          <StatusStates />
        </TabsContent>
        <TabsContent value="primitives">
          <PrimitiveGallery />
        </TabsContent>
        <TabsContent value="tokens">
          <TokenSheet />
        </TabsContent>
      </Tabs>
    </div>
  )
}
