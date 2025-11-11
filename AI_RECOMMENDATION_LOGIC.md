# AI Study Recommendation Logic Explanation

## Overview
The AI Study Recommendation feature analyzes user study patterns and course progress to provide intelligent, personalized study priorities. The system uses a multi-factor scoring algorithm to determine which courses need immediate attention.

## Algorithm (≤200 words)

### Priority Score Calculation
Each course receives a priority score (0-100) based on four weighted factors:

1. **Completion Percentage (40% weight)**: Courses with lower completion rates receive higher priority. A course at 20% completion scores higher than one at 80%, encouraging users to catch up on lagging courses.

2. **Days Since Last Study (30% weight)**: Courses that haven't been studied recently are prioritized. If a course hasn't been touched in 7+ days, it gains urgency points. This prevents knowledge decay and maintains consistent learning.

3. **Weekly Study Time (20% weight)**: Courses with minimal study time this week (<30 minutes) get priority boost. This ensures balanced attention across all courses.

4. **Progress Urgency (10% weight)**: Courses near completion (80-99%) receive a small boost to encourage finishing strong.

### Priority Levels
- **High Priority (score ≥70)**: Urgent attention needed. These courses are significantly behind or neglected.
- **Medium Priority (score 40-69)**: Should study soon. Moderate attention required.
- **Low Priority (score <40)**: Maintain current pace. Course is on track.

### Personalized Recommendations
The system generates contextual reasons based on the dominant factor (e.g., "Only 25% complete. Focus needed to catch up.") and suggests study duration based on user's historical patterns and course priority.

This creates an adaptive recommendation system that balances urgency, consistency, and progress to optimize learning outcomes.

