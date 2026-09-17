import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/primitives'
import { PrimitiveGallery } from './PrimitiveGallery'
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
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Specimens</h1>
        <p className={styles.lede}>
          Every token, primitive and evidence state, rendered by the code the screens
          use.
        </p>
      </header>
      <Tabs defaultValue="states">
        <TabsList>
          <TabsTrigger value="states">Evidence states</TabsTrigger>
          <TabsTrigger value="primitives">Primitives</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>
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
