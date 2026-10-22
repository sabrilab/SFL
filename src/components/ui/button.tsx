import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Les rangs de bouton de Bola (app/boutons.css) : `default` est le principal,
// le verre allumé (argent) ; `secondary` et `outline`, le verre fumé ;
// `ghost`, le discret. Les tons (`vert`, `or`, `mauve`, `braise`, `rouge`)
// allument le verre dans une couleur de la DA ; `destructive` reste un
// secondaire rouge. Un secondaire ou un discret prend son ton par la classe :
// <Button variant="secondary" className="bouton--vert">.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full text-sm font-semibold whitespace-nowrap select-none disabled:pointer-events-none aria-invalid:ring-3 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bouton-principal",
        vert: "bouton-principal bouton--vert",
        or: "bouton-principal bouton--or",
        mauve: "bouton-principal bouton--mauve",
        braise: "bouton-principal bouton--braise",
        rouge: "bouton-principal bouton--rouge",
        outline: "bouton-secondaire",
        secondary: "bouton-secondaire",
        ghost: "bouton-discret",
        destructive: "bouton-secondaire bouton--rouge",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-3.5 text-[0.8rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-1.5 px-6 text-[0.95rem] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
