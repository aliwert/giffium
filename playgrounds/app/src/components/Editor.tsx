import { interpolate, interpolateColors, Easing } from 'remotion'
import { encode } from 'modern-gif'
import workerUrl from 'modern-gif/worker?url'
import 'shiki-magic-move/dist/style.css'
import {
  ComboboxItem,
  ComboboxItemLabel,
  ComboboxItemIndicator,
  ComboboxControl,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxContent,
  Combobox,
} from '~/components/ui/combobox'
import { Button } from '~/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { TextField, TextFieldLabel, TextFieldTextArea } from '~/components/ui/text-field'
import { MagicMoveElement } from 'shiki-magic-move/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Slider,
  SliderFill,
  SliderLabel,
  SliderThumb,
  SliderTrack,
  SliderValueLabel,
} from '~/components/ui/slider'
import clsx from 'clsx'
import { TbSettings } from 'solid-icons/tb'
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { createMemo, createResource, createSignal, onCleanup, Setter, Show } from 'solid-js'
import { createHighlighter, bundledThemes, bundledLanguages } from 'shiki'
import { ShikiMagicMove } from 'shiki-magic-move/solid'
import { AnimationFrameConfig } from '~/types'

const animationSeconds = 1
const animationFPS = 10
const animationFrames = animationSeconds * animationFPS

interface EditorProps {
  startCode: string
  setStartCode: Setter<string>
  endCode: string
  setEndCode: Setter<string>
  snippetWidth: number
  setSnippetWidth: Setter<number>
  yPadding: number
  setYPadding: Setter<number>
  xPadding: number
  setXPadding: Setter<number>
  shadowEnabled: boolean
  setShadowEnabled: Setter<boolean>
  shadowOffsetY: number
  setShadowOffsetY: Setter<number>
  shadowBlur: number
  setShadowBlur: Setter<number>
  shadowColor: string
  setShadowColor: Setter<string>
  shadowOpacity: number
  setShadowOpacity: Setter<number>
  bgColor: string
  setBgColor: Setter<string>
  language: string
  setLanguage: Setter<string>
  theme: string
  setTheme: Setter<string>
}

export default function Editor(props: EditorProps) {
  const [selectedTab, setSelectedTab] = createSignal<'snippets' | 'output'>('snippets')
  const [toggled, setToggled] = createSignal(false)

  const [magicMoveElements, setMagicMoveElements] = createSignal<MagicMoveElement[]>([])
  const [maxContainerDimensions, setMaxContainerDimensions] = createSignal<{
    width: number
    height: number
  }>()
  const [code, setCode] = createSignal(props.startCode)
  const [isResizing, setIsResizing] = createSignal(false)
  const [isLooping, setIsLooping] = createSignal(true)
  const [isGenerating, setIsGenerating] = createSignal(false)
  const [isGenerated, setIsGenerated] = createSignal(false)
  const [gifDataUrl, setGifDataUrl] = createSignal('')
  const [isShowingGifDialog, setIsShowingGifDialog] = createSignal(false)

  const [highlighter] = createResource(async () => {
    const newHighlighter = await createHighlighter({
      themes: Object.keys(bundledThemes),
      langs: Object.keys(bundledLanguages),
    })

    return newHighlighter
  })

  const intervalId = setInterval(() => {
    if (
      selectedTab() === 'output' &&
      props.startCode !== '' &&
      props.endCode !== '' &&
      !isResizing() &&
      isLooping()
    ) {
      if (toggled()) {
        setCode(props.startCode)
      } else {
        setCode(props.endCode)
      }
      setToggled(!toggled())
    }
  }, 3000)

  onCleanup(() => {
    clearInterval(intervalId)
  })

  document.body.addEventListener('mousemove', e => {
    if (isResizing()) {
      const deltaX = e.movementX
      console.log('mousemove')
      // console.log(e.)
      props.setSnippetWidth(props.snippetWidth + deltaX)
    }
  })

  document.body.addEventListener('mouseup', e => {
    if (isResizing()) {
      setIsResizing(false)
    }
  })

  const generateGifDataUrl = createMemo(() => {
    return async function () {
      const container = document.querySelector('.shiki-magic-move-container') as HTMLPreElement

      const canvasFrames: ImageData[] = []
      const backgroundColor = container.style.backgroundColor

      let fontSize = ''
      let fontFamily = ''

      magicMoveElements().some(el => {
        const computedStyle = window.getComputedStyle(el.el)
        fontSize = computedStyle.getPropertyValue('font-size')
        fontFamily = computedStyle.getPropertyValue('font-family')

        return fontSize && fontFamily
      })

      const loopedFrames = []
      const middleFrames = []

      for (let i = 0; i < animationFrames; i++) {
        middleFrames.push(i)
      }

      const pauseFrameLength = 15
      const firstFrames = new Array(pauseFrameLength).fill(0)
      const lastFrames = new Array(pauseFrameLength).fill(animationFrames)

      loopedFrames.push(
        ...firstFrames,
        ...middleFrames,
        ...lastFrames,
        ...middleFrames.toReversed(),
      )

      for (let frame = 0; frame < loopedFrames.length; frame++) {
        const actualFrame = loopedFrames[frame]

        const canvas = await createAnimationFrame(
          magicMoveElements(),
          actualFrame,
          maxContainerDimensions()?.width || 100,
          maxContainerDimensions()?.height || 100,
          {
            layout: {
              yPadding: props.yPadding,
              xPadding: props.xPadding,
            },
            shadow: {
              shadowEnabled: props.shadowEnabled,
              shadowOffsetY: props.shadowOffsetY,
              shadowBlur: props.shadowBlur,
              shadowColor: props.shadowColor,
              shadowOpacity: props.shadowOpacity,
            },
            styling: {
              fontSize,
              fontFamily,
              snippetBackgroundColor: backgroundColor,
              backgroundColor: props.bgColor,
            },
          },
        )

        canvasFrames.push(canvas)
      }

      const blob = await encode({
        workerUrl,
        format: 'blob',
        width: canvasFrames[0].width,
        height: canvasFrames[0].height,
        frames: canvasFrames,
      })

      const dataUrl = await blobToDataURL(blob)

      return dataUrl?.toString() || ''
    }
  })

  return (
    <>
      <Tabs defaultValue="snippets" class="w-full" value={selectedTab()} onChange={setSelectedTab}>
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="snippets">Step 1: Snippets</TabsTrigger>
          <TabsTrigger value="output">Step 2: Output</TabsTrigger>
        </TabsList>
        <TabsContent value="snippets">
          <div class="flex flex-row p-2 gap-2 dark:bg-[#27272a] bg-gray-100 rounded-t justify-between">
            <div class="flex flex-row gap-2 items-center">
              <div class="">Enter the code snippets you would like to diff</div>
            </div>
            <div class="flex flex-row gap-2">
              <Button
                onClick={() => {
                  setSelectedTab('output')
                }}
                disabled={props.startCode === '' || props.endCode === ''}
              >
                Next
              </Button>
            </div>
          </div>

          <div class="dark:bg-[#27272a] bg-gray-100 p-2 rounded-b flex flex-row flex-wrap md:flex-nowrap gap-2">
            <TextField
              class="w-full md:w-1/2"
              value={props.startCode}
              onChange={props.setStartCode}
            >
              <TextFieldLabel>Start Code</TextFieldLabel>
              <TextFieldTextArea class="h-[400px]" placeholder="Type your message here." />
            </TextField>

            <TextField class="w-full md:w-1/2" value={props.endCode} onChange={props.setEndCode}>
              <TextFieldLabel>End Code</TextFieldLabel>
              <TextFieldTextArea class="h-[400px]" placeholder="Type your message here." />
            </TextField>
          </div>
        </TabsContent>
        <TabsContent value="output">
          <div
            class="flex flex-row p-2 gap-2 dark:bg-[#27272a] bg-gray-100 rounded-t justify-between"
            id="toolbar"
          >
            <div class="flex flex-row gap-2" id="toolbar-left">
              <Combobox
                value={props.theme}
                options={Object.keys(bundledThemes)}
                onChange={props.setTheme}
                placeholder="Search a theme..."
                itemComponent={props => (
                  <ComboboxItem item={props.item}>
                    <ComboboxItemLabel class="dark:text-black">
                      {props.item.rawValue}
                    </ComboboxItemLabel>
                    <ComboboxItemIndicator />
                  </ComboboxItem>
                )}
              >
                <ComboboxControl aria-label="Theme" class="bg-white">
                  <ComboboxInput />
                  <ComboboxTrigger />
                </ComboboxControl>
                <ComboboxContent style={{ 'max-height': '200px', overflow: 'auto' }} />
              </Combobox>

              <Combobox
                value={props.language}
                options={Object.keys(bundledLanguages)}
                onChange={props.setLanguage}
                placeholder="Search a Language..."
                itemComponent={props => (
                  <ComboboxItem item={props.item}>
                    <ComboboxItemLabel>{props.item.rawValue}</ComboboxItemLabel>
                    <ComboboxItemIndicator />
                  </ComboboxItem>
                )}
              >
                <ComboboxControl aria-label="Language" class="bg-white">
                  <ComboboxInput />
                  <ComboboxTrigger />
                </ComboboxControl>
                <ComboboxContent style={{ 'max-height': '200px', overflow: 'auto' }} />
              </Combobox>

              <DropdownMenu
                onOpenChange={open => {
                  setIsLooping(!open)
                }}
              >
                <DropdownMenuTrigger>
                  <Button class="flex flex-row items-center gap-2">
                    Settings
                    <TbSettings size={24} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent class="w-[160px]">
                    <DropdownMenuItem
                      class="flex flex-row items-center justify-between"
                      closeOnSelect={false}
                    >
                      <Label for="bg-color-input" class="font-normal">
                        BG Color
                      </Label>
                      <input
                        id="bg-color-input"
                        class="h-6 w-6 rounded"
                        type="color"
                        value={props.bgColor}
                        onInput={e => props.setBgColor(e.target.value)}
                      />
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Layout</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem>
                            <Slider
                              value={[props.yPadding]}
                              minValue={0}
                              maxValue={200}
                              onChange={e => {
                                props.setYPadding(e[0])
                              }}
                            >
                              <div class="flex w-full justify-between mb-2">
                                <SliderLabel>Padding (y)</SliderLabel>
                                <SliderValueLabel />
                              </div>
                              <SliderTrack>
                                <SliderFill />
                                <SliderThumb />
                              </SliderTrack>
                            </Slider>
                          </DropdownMenuItem>

                          <DropdownMenuItem>
                            <Slider
                              value={[props.xPadding]}
                              minValue={0}
                              maxValue={200}
                              onChange={e => {
                                props.setXPadding(e[0])
                              }}
                            >
                              <div class="flex w-full justify-between mb-2">
                                <SliderLabel>Padding (x)</SliderLabel>
                                <SliderValueLabel />
                              </div>
                              <SliderTrack>
                                <SliderFill />
                                <SliderThumb />
                              </SliderTrack>
                            </Slider>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Shadow</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent class="w-[200px]">
                          <DropdownMenuItem
                            class="flex flex-row items-center justify-between"
                            closeOnSelect={false}
                            onSelect={() => {
                              props.setShadowEnabled(!props.shadowEnabled)
                            }}
                          >
                            <Label for="shadow-checkbox">Show Shadow</Label>
                            <Checkbox
                              id="shadow-checkbox"
                              checked={props.shadowEnabled}
                              onChange={props.setShadowEnabled}
                            />
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            class="flex flex-row items-center justify-between"
                            closeOnSelect={false}
                          >
                            <Label for="shadow-color-input" class="font-normal">
                              Color
                            </Label>

                            <input
                              id="shadow-color-input"
                              class="h-6 w-6 rounded"
                              type="color"
                              value={props.shadowColor}
                              onInput={e => props.setShadowColor(e.target.value)}
                            />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            class="flex flex-row items-center justify-between"
                            closeOnSelect={false}
                          >
                            <Slider
                              value={[props.shadowOpacity]}
                              step={0.01}
                              minValue={0}
                              maxValue={1}
                              onChange={e => {
                                props.setShadowOpacity(e[0])
                              }}
                            >
                              <div class="flex w-full justify-between mb-2">
                                <SliderLabel>Opacity</SliderLabel>
                                <SliderValueLabel />
                              </div>
                              <SliderTrack>
                                <SliderFill />
                                <SliderThumb />
                              </SliderTrack>
                            </Slider>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Slider
                              value={[props.shadowOffsetY]}
                              minValue={0}
                              maxValue={props.yPadding}
                              onChange={e => {
                                props.setShadowOffsetY(e[0])
                              }}
                            >
                              <div class="flex w-full justify-between mb-2">
                                <SliderLabel>Offset Y</SliderLabel>
                                <SliderValueLabel />
                              </div>
                              <SliderTrack>
                                <SliderFill />
                                <SliderThumb />
                              </SliderTrack>
                            </Slider>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Slider
                              value={[props.shadowBlur]}
                              minValue={0}
                              maxValue={200}
                              onChange={e => {
                                props.setShadowBlur(e[0])
                              }}
                            >
                              <div class="flex w-full justify-between mb-2">
                                <SliderLabel>Blur</SliderLabel>
                                <SliderValueLabel />
                              </div>
                              <SliderTrack>
                                <SliderFill />
                                <SliderThumb />
                              </SliderTrack>
                            </Slider>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            </div>
            <div class="flex flex-row gap-2" id="toolbar-right">
              <Button
                onClick={async () => {
                  setIsGenerating(true)
                  setTimeout(async () => {
                    const dataUrl = await generateGifDataUrl()()
                    setGifDataUrl(dataUrl)
                    setIsGenerating(false)
                    setIsShowingGifDialog(true)
                  }, 0)
                }}
              >
                {isGenerating() ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>

          <div
            id="preview-wrapper"
            class="dark:bg-[#27272a] bg-gray-100 p-2 rounded-b"
            style={{
              'min-height': `${(maxContainerDimensions()?.height || 100) + 40}px`,
            }}
          >
            <p class="text-center">Preview</p>
            <div class="flex flex-row items-center justify-center">
              <div
                class="flex flex-row items-center justify-center overflow-hidden"
                style={{
                  background: props.bgColor,
                  padding: `${props.yPadding}px ${props.xPadding}px`,
                }}
              >
                <div class="flex flex-row items-center justify-center relative margin-auto w-fit">
                  <Show when={highlighter()}>
                    {highlighter => (
                      <>
                        <div
                          class="rounded"
                          style={{
                            width: `${props.snippetWidth}px`,
                            'overflow-x': 'hidden',
                            'box-shadow': props.shadowEnabled
                              ? `0 ${props.shadowOffsetY}px ${props.shadowBlur}px ${
                                  props.shadowColor
                                }${(props.shadowOpacity * 255).toString(16)}`
                              : 'none',
                          }}
                        >
                          <ShikiMagicMove
                            lang={props.language}
                            theme={props.theme}
                            class="p-4 shadow-xl rounded select-none overflow-hidden !text-pretty"
                            highlighter={highlighter()}
                            code={code()}
                            options={{
                              duration: 800,
                              stagger: 0,
                              lineNumbers: false,
                              onAnimationStart: async (elements, maxContainerDimensions) => {
                                if (elements.length === 0) {
                                  return
                                }

                                setMagicMoveElements(elements)
                                setMaxContainerDimensions(maxContainerDimensions)
                              },
                            }}
                          />
                        </div>
                        <div
                          class={clsx(
                            'w-[8px] bg-slate-400 opacity-10 hover:opacity-60 rounded-r h-full absolute top-0 left-[calc(100%-8px)] bottom-0 transition-opacity',
                            {
                              'opacity-60': isResizing(),
                            },
                          )}
                          style={{
                            cursor: isResizing() ? 'grabbing' : 'grab',
                          }}
                          onMouseDown={e => {
                            setIsResizing(true)
                          }}
                        ></div>
                      </>
                    )}
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={isShowingGifDialog()} onOpenChange={setIsShowingGifDialog} modal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div class="flex flex-row items-center justify-between gap-2">
                <h3>Result</h3>
              </div>
            </DialogTitle>
            <DialogDescription>
              Copying the image via right click will only copy the current frame. Please download
              the GIF below by using the Download button or right clicking and using "Save Image
              as...".
            </DialogDescription>
          </DialogHeader>
          <img src={gifDataUrl()} alt="Generated gif" />
          <DialogFooter>
            <Button
              onClick={async () => {
                const blob = dataURItoBlob(gifDataUrl())
                const filename = 'giffium.gif'
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = filename
                link.click()
              }}
            >
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function dataURItoBlob(dataURI: string) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1])

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length)

  // create a view into the buffer
  var ia = new Uint8Array(ab)

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], { type: mimeString })
  return blob
}

function blobToDataURL(blob: Blob): Promise<string | ArrayBuffer | null | undefined> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      resolve(e.target?.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function htmlDecode(str: string) {
  const txt = document.createElement('textarea')
  txt.innerHTML = str
  return txt.value
}

const snippetPadding = 16

async function createAnimationFrame(
  elements: MagicMoveElement[],
  frame: number,
  width: number = 100,
  height: number = 100,
  config: AnimationFrameConfig,
) {
  const { yPadding, xPadding } = config.layout
  const { shadowEnabled, shadowOffsetY, shadowBlur, shadowColor, shadowOpacity } = config.shadow
  const { fontSize, fontFamily, backgroundColor, snippetBackgroundColor } = config.styling

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: false })
  canvas.width = width + xPadding * 2
  canvas.height = height + yPadding * 2
  ctx!.fillStyle = backgroundColor
  ctx?.fillRect(0, 0, canvas.width, canvas.height)

  ctx!.fillStyle = snippetBackgroundColor
  if (shadowEnabled) {
    ctx!.shadowColor = `${shadowColor}${(shadowOpacity * 255).toString(16)}`
    ctx!.shadowBlur = shadowBlur
    ctx!.shadowOffsetX = 0
    ctx!.shadowOffsetY = shadowOffsetY
  }

  ctx!.beginPath()
  ctx!.roundRect(xPadding, yPadding, width, height, 4)
  ctx!.fill()

  ctx!.shadowColor = 'transparent'

  const xModifier = xPadding
  const yModifier = yPadding + snippetPadding

  const elementPromises = elements.map(async el => {
    const x = interpolate(
      frame,
      [0, animationFrames],
      [el.x.start + xModifier, el.x.end + xModifier],
      {
        easing: Easing.inOut(Easing.quad),
      },
    )
    const y = interpolate(
      frame,
      [0, animationFrames],
      [el.y.start + yModifier, el.y.end + yModifier],
      {
        easing: Easing.inOut(Easing.quad),
      },
    )
    const opacity = interpolate(frame, [0, animationFrames], [el.opacity.start, el.opacity.end], {
      easing: Easing.inOut(Easing.quad),
    })
    const color = interpolateColors(
      frame,
      [0, animationFrames],
      [el.color.start || 'rgba(0,0,0,0)', el.color.end || 'rgba(0,0,0,0)'],
    )

    ctx!.font = `${fontSize} ${fontFamily}`
    ctx!.fillStyle = color
    ctx!.globalAlpha = opacity
    ctx!.fillText(htmlDecode(el.el.innerHTML), x, y)
  })
  await Promise.all(elementPromises)

  return ctx!.getImageData(0, 0, canvas.width, canvas.height)
}
