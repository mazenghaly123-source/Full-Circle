# Approvals are logged; staff move the stage

When a client approves a decision in the portal, the approval is written to the order's append-only
log (with a copy of the decision text and photos that were approved) and the decision closes, but
the order does not move to the next stage. Staff move it, so the floor stays in control of what
happens next. The prototype's demo moves the stage itself; the real portal shows "Approved, waiting
on Full Circle" instead, and staff are alerted.
