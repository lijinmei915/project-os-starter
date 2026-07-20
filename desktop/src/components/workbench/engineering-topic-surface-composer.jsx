/**
 * Chooses the rendered surface for an engineering topic.
 *
 * The individual panels stay owned by their domain modules; this component
 * only owns the display precedence between overview, capability, dedicated
 * governance surfaces, and the generic topic fallback.
 */
export function EngineeringTopicSurfaceComposer({
  isOverviewTopic = false,
  overviewPanel = null,
  capabilityPanel = null,
  capabilitySupplementPanels = [],
  dedicatedPanels = [],
  topicPanel = null,
  fallback = null,
}) {
  if (isOverviewTopic) return overviewPanel;

  if (capabilityPanel) {
    return (
      <>
        {capabilityPanel}
        {capabilitySupplementPanels.filter(Boolean).map((panel, index) => (
          <React.Fragment key={index}>
            {panel}
          </React.Fragment>
        ))}
      </>
    );
  }

  return dedicatedPanels.find(Boolean) || topicPanel || fallback;
}
import React from "react";
