import { CheckoutForm } from '@/components/commerce/checkout-form'
import { getMissionControlDownloadUrl, getMissionControlPricingUrl, listBillingPlans, type BillingPlanId } from '@/lib/billing'

function isBillingPlanId(value: string): value is BillingPlanId {
  return value === 'personal' || value === 'pro' || value === 'team'
}

export default async function PurchaseCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rawPlan = Array.isArray(params.plan) ? params.plan[0] : params.plan
  const rawCheckout = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout

  const initialPlanId: BillingPlanId = rawPlan && isBillingPlanId(rawPlan) ? rawPlan : 'pro'

  return (
    <CheckoutForm
      plans={listBillingPlans()}
      initialPlanId={initialPlanId}
      wasCanceled={rawCheckout === 'canceled'}
      pricingUrl={getMissionControlPricingUrl()}
      downloadUrl={getMissionControlDownloadUrl()}
    />
  )
}
