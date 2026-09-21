import { useState } from 'react'
import {
  Accordion,
  AccordionSection,
  AlertDialog,
  Button,
  Checkbox,
  Dialog,
  DigitField,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PasswordField,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  Tooltip,
} from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import styles from './specimens.module.css'

/**
 * The hand-authored primitives, in their states.
 *
 * Two things to check here rather than trust: a dialog cannot be built without
 * a title naming its subject, and a radio group or select starts with nothing
 * chosen, because several questions in this product must not pre-answer
 * themselves.
 */
export function PrimitiveGallery() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const [switched, setSwitched] = useState(false)
  const [radio, setRadio] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [pin, setPin] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')

  const viewer = useViewer()

  return (
    <div className={styles.sheet}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Buttons</h2>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive" size="large">
            Destructive, 44px target
          </Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" size="small">
            Small
          </Button>
          <Button>
            <Icon name="add-remove-delete/add-01" size={16} />
            With icon
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>At the point of the act</h2>
        <p className={styles.sectionNote}>
          One line, never behind a click, and only for a question the PRD leaves open.
          An act this reader cannot perform is not drawn at all, so there is no refusal
          here and no control that refuses.
        </p>
        <div className={styles.stack}>
          <ActPoint
            answer={viewer.ask('report_incident')}
            label="Report an incident"
            notBuilt="Reporting an incident is not built."
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Digits and passwords</h2>
        <div className={styles.row}>
          <DigitField
            label="Medication PIN"
            length={4}
            masked
            value={pin}
            onValueChange={setPin}
            hint="Also signs a handover and a risk assessment."
          />
          <DigitField
            label="6-digit code"
            length={6}
            value={code}
            onValueChange={setCode}
            hint="Nothing is emailed: any six digits continue."
          />
          <PasswordField label="Password" value={password} onChange={setPassword} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Overlays</h2>
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setAlertOpen(true)}>
            Open confirmation
          </Button>
          <Button variant="secondary" onClick={() => setToastOpen(true)}>
            Show toast
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Dropdown menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Add care note</DropdownMenuItem>
              <DropdownMenuItem>Record medication</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className={styles.popoverText}>
                Supplementary detail, never the only copy of a clinical value.
              </p>
            </PopoverContent>
          </Popover>
          <Tooltip content="A tooltip is never the only place information lives.">
            <Button variant="ghost">Hover for tooltip</Button>
          </Tooltip>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Form controls: nothing starts answered</h2>
        <div className={styles.row}>
          <Checkbox
            label="Flag this note for review"
            checked={checked}
            onCheckedChange={setChecked}
          />
          <Switch
            label="Show my residents only"
            checked={switched}
            onCheckedChange={setSwitched}
          />
          <Select
            label="Not given reason"
            placeholder="Choose a reason"
            value={selected}
            onValueChange={setSelected}
            options={[
              { value: 'resident_refused', label: 'Resident refused' },
              { value: 'resident_asleep', label: 'Resident asleep' },
              { value: 'resident_in_hospital', label: 'Resident in hospital' },
              { value: 'medication_unavailable', label: 'Medication not available' },
              { value: 'resident_vomiting', label: 'Resident vomiting' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
        <div className={styles.stack}>
          <RadioGroup
            legend="Injury"
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: 'not_checked', label: 'Not checked yet' },
              { value: 'no_injury', label: 'Checked: no injury found' },
              { value: 'injuries', label: 'Checked: injuries found' },
            ]}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tabs and accordion</h2>
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General Information</TabsTrigger>
            <TabsTrigger value="needs">Needs</TabsTrigger>
            <TabsTrigger value="people">Important People</TabsTrigger>
          </TabsList>
          <TabsContent value="general">An underline strip is navigation.</TabsContent>
          <TabsContent value="needs">A pill is a filter.</TabsContent>
          <TabsContent value="people">
            A segmented control is a presentation.
          </TabsContent>
        </Tabs>
        <Accordion type="single" collapsible>
          <AccordionSection
            value="one"
            title="Collapsing is for detail, never for status"
          >
            A collapsed section is indistinguishable from an absent one at a glance, so
            no gap lives behind a disclosure.
          </AccordionSection>
        </Accordion>
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Care note for Emmanuel"
        description="The subject is named in the title, because a record saved against the wrong resident is the failure this guards."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Submit</Button>
          </>
        }
      />
      <AlertDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        subject={{ kind: 'resident', name: 'Emmanuel Okafor', room: '14' }}
        action="Record 08:00 medications"
        description="Amlodipine 5mg will be recorded as given at 08:04 by N. Eze. A recorded dose cannot be edited afterwards."
        confirmLabel="Record medications"
        onConfirm={() => setAlertOpen(false)}
      />
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        tone="positive"
        title="Note saved for Emmanuel Okafor"
        description="Recorded at 08:04 by N. Eze."
      />
    </div>
  )
}
